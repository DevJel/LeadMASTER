package pro.leadmaster.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.os.Environment
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.View
import android.view.Gravity
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat

class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private lateinit var nav: LinearLayout
    private val navButtons = linkedMapOf<String, Button>()
    private val appSections = setOf("home", "emails", "audience", "metrics", "profile")
    private var currentSection = "home"
    private val sectionLabels = mapOf("home" to "Homepage", "emails" to "Emails", "audience" to "Audience", "metrics" to "Metrics", "profile" to "Profile")
    private val appHost = "leadmaster.jelvan.pro"
    private val homeUrl = "https://leadmaster.jelvan.pro/login.html"
    private val channelId = "leadmaster_updates"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        window.statusBarColor = Color.WHITE
        window.navigationBarColor = Color.WHITE
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        createNotificationChannel()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.WHITE)
        }
        web = WebView(this).apply {
            setBackgroundColor(Color.WHITE)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            if (Build.VERSION.SDK_INT >= 26) settings.safeBrowsingEnabled = true
            CookieManager.getInstance().setAcceptCookie(true)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
            addJavascriptInterface(NativeBridge(), "LeadMasterNative")
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val uri = request?.url ?: return true
                    val internal = uri.scheme == "https" && uri.host == appHost &&
                        (uri.port == -1 || uri.port == 443) && uri.userInfo == null
                    if (internal) return false
                    if (uri.scheme == "https" || uri.scheme == "http" ||
                        uri.scheme == "mailto" || uri.scheme == "tel") {
                        return try {
                            val intent = Intent(Intent.ACTION_VIEW, uri)
                            if (intent.resolveActivity(packageManager) != null) startActivity(intent)
                            true
                        } catch (_: Exception) { true }
                    }
                    return true
                }
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    val onWorkspace = runCatching {
                        val uri = Uri.parse(url)
                        uri.scheme == "https" && uri.host == appHost && uri.path?.contains("/dashboard") == true
                    }.getOrDefault(false)
                    nav.visibility = if (onWorkspace) View.VISIBLE else View.GONE
                    updateSelectedNavigation(currentSection)
                    view?.evaluateJavascript("document.documentElement.style.setProperty('--lm-native-app','1')", null)
                    view?.evaluateJavascript("(function(){if(window.__lmNativeSectionListener)return;window.__lmNativeSectionListener=true;document.addEventListener('click',function(e){var b=e.target.closest('.tab-link,.bottom-tab');if(b&&window.LeadMasterNative)window.LeadMasterNative.sectionChanged((b.textContent||'').trim());},true);return document.querySelector('.tab-link.active')?.textContent?.trim()||'Homepage';})()") { value -> sectionChangedFromNative(value?.trim('"') ?: "Homepage") }
                }
                override fun doUpdateVisitedHistory(view: WebView?, url: String?, isReload: Boolean) {
                    super.doUpdateVisitedHistory(view, url, isReload)
                    updateSelectedNavigation(currentSection)
                }
            }
            setDownloadListener(DownloadListener { url, _, contentDisposition, mimeType, _ ->
                if (url.startsWith("https://$appHost/")) {
                    val request = DownloadManager.Request(Uri.parse(url))
                        .setTitle("LeadMASTER message")
                        .setDescription("Saving your email")
                        .setMimeType(mimeType ?: "message/rfc822")
                        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "LeadMASTER-message.eml")
                    CookieManager.getInstance().getCookie(url)?.let { request.addRequestHeader("Cookie", it) }
                    getSystemService(DOWNLOAD_SERVICE).let { (it as DownloadManager).enqueue(request) }
                }
            })
        }
        nav = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.WHITE)
            setPadding(4, 8, 4, 8)
            elevation = 10f
            visibility = View.GONE
        }
        addNavButton("Home", "home")
        addNavButton("Emails", "emails")
        addNavButton("Audience", "audience")
        addNavButton("Metrics", "metrics")
        addNavButton("Profile", "profile")
        root.addView(web, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(nav, LinearLayout.LayoutParams(-1, dp(58)))
        setContentView(root)
        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(homeUrl)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.url?.contains("/dashboard") == true) {
                    if (currentSection != "home") {
                        navigateToSection("home")
                    } else if (web.canGoBack()) {
                        web.goBack()
                    } else {
                        web.evaluateJavascript("location.href='/login.html'", null)
                    }
                } else if (web.canGoBack()) web.goBack() else finish()
            }
        })
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7001)
        }
    }

    private fun addNavButton(label: String, section: String) {
        val button = Button(this).apply {
            text = label
            textSize = 10.5f
            isAllCaps = false
            minHeight = 0
            minimumHeight = 0
            setPadding(dp(2), 0, dp(2), 0)
            setTextColor(Color.rgb(75, 75, 75))
            setBackgroundColor(Color.TRANSPARENT)
            contentDescription = label
            setOnClickListener {
                if (section in appSections) {
                    navigateToSection(section)
                }
            }
        }
        navButtons[section] = button
        nav.addView(button, LinearLayout.LayoutParams(0, -1, 1f))
    }

    private fun navigateToSection(section: String) {
        val tab = sectionLabels[section] ?: return
        web.evaluateJavascript("(()=>{const b=[...document.querySelectorAll('.tab-link')].find(x=>x.textContent.trim().startsWith('$tab'));if(b){b.click();window.scrollTo(0,0);return true;}return false;})()", null)
        updateSelectedNavigation(section)
    }

    private fun sectionChangedFromNative(label: String) {
        val section = sectionLabels.entries.firstOrNull { it.value == label }?.key ?: return
        updateSelectedNavigation(section)
    }

    private fun updateSelectedNavigation(rawSection: String) {
        val section = rawSection.takeIf { it in appSections } ?: "home"
        currentSection = section
        navButtons.forEach { (key, button) ->
            val selected = key == section
            button.setTextColor(if (selected) Color.rgb(20, 20, 20) else Color.rgb(105, 105, 105))
            button.typeface = android.graphics.Typeface.create(
                "sans-serif", if (selected) android.graphics.Typeface.BOLD else android.graphics.Typeface.NORMAL
            )
            button.background = GradientDrawable().apply {
                setColor(if (selected) Color.rgb(239, 239, 239) else Color.TRANSPARENT)
                cornerRadius = dp(9).toFloat()
            }
            button.isSelected = selected
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "LeadMASTER updates", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "New email and account updates"
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private inner class NativeBridge {
        @JavascriptInterface
        fun sectionChanged(label: String?) {
            runOnUiThread { sectionChangedFromNative(label.orEmpty()) }
        }

        @JavascriptInterface
        fun notify(title: String?, message: String?) {
            runOnUiThread {
                if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return@runOnUiThread
                val notification = NotificationCompat.Builder(this@MainActivity, channelId)
                    .setSmallIcon(android.R.drawable.ic_dialog_email)
                    .setContentTitle((title ?: "LeadMASTER").take(80))
                    .setContentText((message ?: "You have a new update.").take(180))
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .build()
                getSystemService(NotificationManager::class.java).notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notification)
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        web.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        if (::web.isInitialized) {
            web.removeJavascriptInterface("LeadMasterNative")
            web.stopLoading()
            web.destroy()
        }
        super.onDestroy()
    }
}