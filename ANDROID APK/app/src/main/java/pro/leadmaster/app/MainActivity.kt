package pro.leadmaster.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.media.AudioAttributes
import android.provider.Settings
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.ValueCallback
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class MainActivity : ComponentActivity() {
    private var webView: WebView? = null
    private var pageProgress by mutableIntStateOf(0)
    private var pageLoading by mutableStateOf(true)
    private var pageLoadError by mutableStateOf(false)
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private val filePicker = registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        fileChooserCallback?.onReceiveValue(uris.toTypedArray())
        fileChooserCallback = null
    }
    private val channelId = "leadmaster_updates"
    private val notificationChannelIds = mapOf("sent" to "leadmaster_email_sent", "deleted" to "leadmaster_email_deleted", "received" to "leadmaster_mail_received", "general" to "leadmaster_general")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        createNotificationChannel()

        setContent {
            WorkspaceWebView(
                modifier = Modifier.fillMaxSize(),
                savedState = savedInstanceState
            )
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val web = webView
                if (web?.canGoBack() == true) {
                    web.goBack()
                } else {
                    finish()
                }
            }
        })

        if (
            Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7001)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Composable
    private fun WorkspaceWebView(
        modifier: Modifier,
        savedState: Bundle?
    ) {
        Box(modifier = modifier.fillMaxSize()) {
            AndroidView(
                modifier = Modifier.fillMaxSize().then(if (pageLoading || pageLoadError) Modifier.blur(10.dp) else Modifier),
                factory = { context ->
                    createWebView(context).also { view ->
                        webView = view
                        val restored = if (savedState != null) view.restoreState(savedState) else null
                        if (restored == null) view.loadUrl(WorkspaceViewModel.HOME_URL)
                    }
                }
            )
            AnimatedVisibility(
                visible = pageLoading || pageLoadError,
                enter = fadeIn(),
                exit = fadeOut(),
                modifier = Modifier.fillMaxSize()
            ) {
                NativeLoadingOverlay(
                    progress = pageProgress,
                    failed = pageLoadError,
                    onRetry = {
                        pageLoadError = false
                        pageLoading = true
                        pageProgress = 0
                        webView?.reload() ?: run { webView?.loadUrl(WorkspaceViewModel.HOME_URL) }
                    }
                )
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView(context: Context): WebView {
        return WebView(context).apply {
            setBackgroundColor(android.graphics.Color.TRANSPARENT)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = false
            settings.textZoom = 100
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.safeBrowsingEnabled = true
            CookieManager.getInstance().setAcceptCookie(true)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
            addJavascriptInterface(NativeBridge(), "LeadMasterNative")
            webChromeClient = object : WebChromeClient() {
                override fun onProgressChanged(view: WebView?, newProgress: Int) {
                    super.onProgressChanged(view, newProgress)
                    pageProgress = newProgress.coerceIn(0, 100)
                }

                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    fileChooserCallback?.onReceiveValue(null)
                    fileChooserCallback = filePathCallback
                    return try {
                        filePicker.launch(arrayOf("*/*"))
                        true
                    } catch (_: Exception) {
                        fileChooserCallback?.onReceiveValue(null)
                        fileChooserCallback = null
                        false
                    }
                }
            }
            webViewClient = object : WebViewClient() {
                override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                    super.onPageStarted(view, url, favicon)
                    pageLoading = true
                    pageLoadError = false
                    pageProgress = 0
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: android.webkit.WebResourceError?
                ) {
                    super.onReceivedError(view, request, error)
                    if (request?.isForMainFrame == true) {
                        pageLoading = false
                        pageLoadError = true
                    }
                }

                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val uri = request?.url ?: return true
                    val internal = uri.scheme == "https" &&
                        uri.host == WorkspaceViewModel.APP_HOST &&
                        (uri.port == -1 || uri.port == 443) &&
                        uri.userInfo == null
                    if (internal) return false
                    if (uri.scheme == "https" || uri.scheme == "http" ||
                        uri.scheme == "mailto" || uri.scheme == "tel"
                    ) {
                        return try {
                            val intent = Intent(Intent.ACTION_VIEW, uri)
                            if (intent.resolveActivity(packageManager) != null) startActivity(intent)
                            true
                        } catch (_: Exception) {
                            true
                        }
                    }
                    return true
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    CookieManager.getInstance().flush()
                    view?.evaluateJavascript(nativeLoginStyleScript) {
                        pageLoading = false
                        pageLoadError = false
                        pageProgress = 100
                    }
                    view?.evaluateJavascript(
                        """
                        (function(){
                          var root=document.querySelector('#root .app-shell');
                          var syncTheme=function(){
                            if(window.LeadMasterNative){
                              window.LeadMasterNative.themeChanged(root?.getAttribute('data-theme')==='dark');
                            }
                          };
                          syncTheme();
                          if(root&&!window.__lmNativeThemeObserver){
                            window.__lmNativeThemeObserver=new MutationObserver(syncTheme);
                            window.__lmNativeThemeObserver.observe(root,{attributes:true,attributeFilter:['data-theme']});
                          }
                        })();
                        """.trimIndent(),
                        null
                    )
                    view?.evaluateJavascript(notificationMonitorScript, null)
                }


            }
            setDownloadListener(DownloadListener { url, _, _, mimeType, _ ->
                val allowedPrefix = "https://" + WorkspaceViewModel.APP_HOST + "/"
                if (url.startsWith(allowedPrefix)) {
                    val request = DownloadManager.Request(Uri.parse(url))
                        .setTitle("LeadMASTER message")
                        .setDescription("Saving your email")
                        .setMimeType(mimeType ?: "message/rfc822")
                        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        .setDestinationInExternalPublicDir(
                            Environment.DIRECTORY_DOWNLOADS,
                            "LeadMASTER-message.eml"
                        )
                    CookieManager.getInstance().getCookie(url)?.let { request.addRequestHeader("Cookie", it) }
                    (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
                }
            })
        }
    }

    private fun applySystemBarTheme(dark: Boolean) {
        val controller = androidx.core.view.WindowInsetsControllerCompat(window, window.decorView)
        controller.isAppearanceLightStatusBars = !dark
        controller.isAppearanceLightNavigationBars = !dark
    }

    private val nativeLoginStyleScript = """
        (function(){
          if(location.pathname!=='/login.html'||document.getElementById('lm-native-login-theme'))return;
          var style=document.createElement('style');
          style.id='lm-native-login-theme';
          style.textContent=`
            :root{color-scheme:dark}
            html,body{min-height:100%;margin:0;background:#777!important;color:#f5f5f5}
            body{background:radial-gradient(ellipse at 50% 12%,rgba(255,255,255,.25),transparent 44%),linear-gradient(145deg,#929292 0%,#686868 48%,#4e4e4e 100%)!important}
            .layout{min-height:100dvh;display:flex;flex-direction:column;background:transparent!important;position:relative;isolation:isolate}
            .hero{position:fixed;inset:0;min-height:100dvh;background:transparent!important;overflow:hidden;pointer-events:none;z-index:1}
            .hero::after,.hero-art{display:none!important}
            .hero-content{min-height:100dvh;height:100dvh;padding:0!important;display:block!important}
            .hero-top,.hero-center,.hero-footer,.feature-card{display:none!important}
            .hero-wordmark{display:block!important;position:absolute;left:50%;bottom:62px;transform:translateX(-50%);width:min(92%,560px);height:78px;margin:0!important;opacity:.96;overflow:visible}
            .hero-wordmark canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
            .right{position:relative;z-index:2;flex:1;min-height:100dvh;display:flex;flex-direction:column;justify-content:center;align-items:stretch;background:transparent!important}
            .main-content{flex:1;min-height:calc(100dvh - 54px);display:flex;justify-content:center;align-items:center;padding:max(24px,env(safe-area-inset-top)) 22px 164px!important}
            .card{width:100%;max-width:440px;padding:32px 26px;border:1px solid rgba(255,255,255,.12);border-radius:26px;background:linear-gradient(145deg,rgba(28,28,28,.98),rgba(8,8,8,.99))!important;color:#f5f5f5;box-shadow:0 28px 80px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.08);animation:lmCardEnter .48s cubic-bezier(.2,.8,.2,1) both}
            @keyframes lmCardEnter{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
            h2{font-size:25px;line-height:1.2;letter-spacing:-.04em;color:#fff}
            .sub{color:#aaa;margin:9px 0 27px}
            label{font-size:12px;font-weight:650;color:#d5d5d5;letter-spacing:.025em}
            input{height:52px;border-radius:14px;border:1px solid #3b3b3b;background:linear-gradient(180deg,#242424,#1b1b1b);color:#fff;box-shadow:inset 0 1px 2px rgba(0,0,0,.35)}
            input::placeholder{color:#777}
            input:focus{border-color:#ed873f;box-shadow:0 0 0 3px rgba(237,135,63,.16)}
            .password-wrap button{height:52px;color:#f0a06a}
            .field{margin-bottom:20px}
            .challenge{position:absolute!important;width:1px!important;height:1px!important;min-height:1px!important;left:-10000px!important;top:auto!important;margin:0!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important}
            .primary{min-height:52px;border-radius:15px;background:linear-gradient(135deg,#f18a42,#d96520);color:#fff;font-size:15px;box-shadow:0 8px 22px rgba(221,103,34,.22);transition:transform .16s ease,filter .16s ease}
            .primary:not(:disabled):hover{filter:brightness(1.08)}
            .primary:not(:disabled):active{transform:scale(.985)}
            .primary:disabled{background:#75503b;color:#b9a398;box-shadow:none}
            .error{background:#321d1d;border-color:#663333;color:#ffb4a9}
            .back{color:#f0a06a}
            .login-right-footer{position:relative;z-index:3;min-height:48px;padding:8px 16px calc(10px + env(safe-area-inset-bottom));background:transparent!important;color:#bdbdbd;font-size:11px}
            .login-privacy-link{color:#c8c8c8}
            .login-right-footer .lock-mark,.login-privacy-label .privacy-mark{color:#aaa}
            .footer-separator{color:#777}
            @media(max-width:420px){
              .main-content{padding-inline:16px!important;padding-bottom:150px!important}
              .card{padding:28px 21px;border-radius:23px}
              h2{font-size:23px}
              .hero-wordmark{height:68px;bottom:56px;width:94%}
              .login-right-footer{font-size:10px;gap:8px}
            }
            @media(max-height:650px){
              .right{justify-content:flex-start}
              .main-content{min-height:0;padding-top:18px!important;padding-bottom:140px!important}
              .card{padding-top:22px;padding-bottom:22px}
              .hero-wordmark{height:58px;bottom:50px}
            }
            @media(prefers-reduced-motion:reduce){.card{animation:none}}
          `;
          document.head.appendChild(style);
        })();
    """.trimIndent()

    private val notificationMonitorScript = """
        (function(){
          if(window.__lmNativeNotificationMonitor||!window.LeadMasterNative||location.pathname==='/login.html')return;
          window.__lmNativeNotificationMonitor=true;
          var seenActivity=new Set(),seenInbox=new Set(),activityReady=false,inboxReady=false;
          function trimSeen(set){if(set.size>300){var first=set.values().next().value;set.delete(first);}}
          function notify(title,message,type){try{window.LeadMasterNative.notifyEvent(String(title||'LeadMASTER'),String(message||'You have a new update.'),String(type||'general'));}catch(_){}}
          function clean(value){return String(value||'').replace(/\s+/g,' ').slice(0,150);}
          async function checkActivity(){
            try{
              var response=await fetch('/api/admin/activity',{credentials:'same-origin',cache:'no-store'});
              if(!response.ok)return;
              var data=await response.json(),items=Array.isArray(data.items)?data.items:[];
              if(!activityReady){items.forEach(function(x){if(x.id)seenActivity.add(String(x.id));});activityReady=true;return;}
              items.slice().reverse().forEach(function(x){
                var id=x.id?String(x.id):'';
                if(!id||seenActivity.has(id))return;
                seenActivity.add(id);trimSeen(seenActivity);
                var action=String(x.action||'').toLowerCase(),message=clean(x.summary||x.subject||x.from_address||x.sender);
                if(action==='email_sent')notify('Email sent',message||'Your email was sent successfully.','sent');
                else if(action==='email_deleted'||action==='email_permanently_deleted')notify('Email deleted',message||'An email was moved to Deleted.','deleted');
                else if(action==='email_queued')notify('Email queued',message||'Your email was accepted for sending.','general');
                else if(action==='email_failed'||action==='email_unknown')notify('Email status update',message||'Check the sending status in LeadMASTER.','general');
                else if(!['section_viewed','notification_viewed','email_opened','email_read','signed_in','signed_out'].includes(action)){
                  var label=action.replace(/_/g,' ').replace(/^./,function(ch){return ch.toUpperCase();})||'Workspace update';
                  notify('LeadMASTER update',message||label,'general');
                }
              });
            }catch(_){}
          }
          async function checkInbox(){
            try{
              var response=await fetch('/api/admin/mail?folder=inbox',{credentials:'same-origin',cache:'no-store'});
              if(!response.ok)return;
              var data=await response.json(),items=Array.isArray(data.items)?data.items:[];
              if(!inboxReady){items.forEach(function(x){if(x.id)seenInbox.add(String(x.id));});inboxReady=true;return;}
              items.slice().reverse().forEach(function(x){
                var id=x.id?String(x.id):'';
                if(!id||seenInbox.has(id))return;
                seenInbox.add(id);trimSeen(seenInbox);
                var sender=clean(x.from_address||x.sender||x.from).slice(0,70);
                var subject=clean(x.subject||'New message').slice(0,90);
                notify('New email received',[sender,subject].filter(Boolean).join(' · ')||'You have a new message.','received');
              });
            }catch(_){}
          }
          function poll(){if(document.visibilityState==='hidden')return;checkActivity();checkInbox();}
          window.setTimeout(poll,5000);
          window.setInterval(poll,30000);
        })();
    """.trimIndent()

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            val soundAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            val definitions = listOf(
                Triple(notificationChannelIds.getValue("sent"), "Email sent", "Sound for sent email events"),
                Triple(notificationChannelIds.getValue("deleted"), "Email deleted", "Sound for email deletion events"),
                Triple(notificationChannelIds.getValue("received"), "New mail received", "Sound for newly received email"),
                Triple(notificationChannelIds.getValue("general"), "LeadMASTER notifications", "Sound for other LeadMASTER updates")
            )
            definitions.forEach { (id, name, description) ->
                val channel = NotificationChannel(id, name, NotificationManager.IMPORTANCE_DEFAULT).apply {
                    this.description = description
                    setSound(Settings.System.DEFAULT_NOTIFICATION_URI, soundAttributes)
                    enableVibration(true)
                }
                manager.createNotificationChannel(channel)
            }
        }
    }

    private fun postNativeNotification(title: String?, message: String?, eventType: String?) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val category = when (eventType?.lowercase()) {
            "sent" -> "sent"
            "deleted" -> "deleted"
            "received" -> "received"
            else -> "general"
        }
        val notification = NotificationCompat.Builder(this, notificationChannelIds.getValue(category))
            .setSmallIcon(android.R.drawable.ic_dialog_email)
            .setContentTitle((title ?: "LeadMASTER").take(80))
            .setContentText((message ?: "You have a new update.").take(180))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            // The shared dashboard plays mail sounds once while visible. Keep
            // native cards silent to avoid a second delayed sound from polling.
            .setSilent(true)
            .build()
        getSystemService(NotificationManager::class.java).notify(
            (System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notification
        )
    }

    private inner class NativeBridge {
        @JavascriptInterface
        fun themeChanged(dark: Boolean) {
            runOnUiThread { applySystemBarTheme(dark) }
        }

        @JavascriptInterface
        fun notify(title: String?, message: String?) {
            runOnUiThread { postNativeNotification(title, message, "general") }
        }

        @JavascriptInterface
        fun notifyEvent(title: String?, message: String?, eventType: String?) {
            runOnUiThread { postNativeNotification(title, message, eventType) }
        }
    }

    override fun onPause() {
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onStop() {
        CookieManager.getInstance().flush()
        super.onStop()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView?.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        // Persist the authenticated HttpOnly session cookie; closing the app is not sign-out.
        CookieManager.getInstance().flush()
        webView?.let { view ->
            view.removeJavascriptInterface("LeadMasterNative")
            view.stopLoading()
            view.destroy()
        }
        webView = null
        super.onDestroy()
    }
}
