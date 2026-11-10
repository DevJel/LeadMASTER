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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class MainActivity : ComponentActivity() {
    private var webView: WebView? = null
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private val filePicker = registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        fileChooserCallback?.onReceiveValue(uris.toTypedArray())
        fileChooserCallback = null
    }
    private val channelId = "leadmaster_updates"

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
        AndroidView(
            modifier = modifier,
            factory = { context ->
                createWebView(context).also { view ->
                    webView = view
                    val restored = if (savedState != null) view.restoreState(savedState) else null
                    if (restored == null) view.loadUrl(WorkspaceViewModel.HOME_URL)
                }
            }
        )
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

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "LeadMASTER updates",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "New email and account updates"
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private inner class NativeBridge {
        @JavascriptInterface
        fun themeChanged(dark: Boolean) {
            runOnUiThread { applySystemBarTheme(dark) }
        }

        @JavascriptInterface
        fun notify(title: String?, message: String?) {
            runOnUiThread {
                if (
                    Build.VERSION.SDK_INT >= 33 &&
                    ContextCompat.checkSelfPermission(
                        this@MainActivity,
                        Manifest.permission.POST_NOTIFICATIONS
                    ) != PackageManager.PERMISSION_GRANTED
                ) return@runOnUiThread

                val notification = NotificationCompat.Builder(this@MainActivity, channelId)
                    .setSmallIcon(android.R.drawable.ic_dialog_email)
                    .setContentTitle((title ?: "LeadMASTER").take(80))
                    .setContentText((message ?: "You have a new update.").take(180))
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .build()
                getSystemService(NotificationManager::class.java).notify(
                    (System.currentTimeMillis() % Int.MAX_VALUE).toInt(),
                    notification
                )
            }
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
