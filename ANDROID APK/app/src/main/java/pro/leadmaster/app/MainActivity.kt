package pro.leadmaster.app

import android.Manifest
import android.annotation.SuppressLint
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
import android.view.View
import android.view.Gravity
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private lateinit var nav: LinearLayout
    private val appHost = "leadmaster.jelvan.pro"
    private val homeUrl = "https://leadmaster.jelvan.pro/login.html"
    private val channelId = "leadmaster_updates"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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
            settings.safeBrowsingEnabled = true
            CookieManager.getInstance().setAcceptCookie(true)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
            addJavascriptInterface(NativeBridge(), "LeadMasterNative")
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val uri = request?.url ?: return true
                    if (uri.scheme == "https" && uri.host == appHost) return false
                    if (uri.scheme == "https" || uri.scheme == "http") {
                        startActivity(Intent(Intent.ACTION_VIEW, uri))
                        return true
                    }
                    return true
                }
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    nav.visibility = if (url?.contains("/dashboard") == true) View.VISIBLE else View.GONE
                    view?.evaluateJavascript("document.documentElement.style.setProperty('--lm-native-app','1')", null)
                }
            }
            setDownloadListener(DownloadListener { url, _, _, _, _ ->
                if (url.startsWith("https://$appHost/")) {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
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
        addNavButton("Home", "overview")
        addNavButton("Inbox", "emails")
        addNavButton("Activity", "logs")
        addNavButton("Settings", "settings")
        root.addView(web, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(nav, LinearLayout.LayoutParams(-1, dp(58)))
        setContentView(root)
        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(homeUrl)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.url?.contains("/dashboard") == true && web.url?.contains("#") == true) {
                    web.evaluateJavascript("if(location.hash){location.hash='#overview'}else{location.href='/login.html'}", null)
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
            textSize = 11f
            isAllCaps = false
            setTextColor(Color.rgb(40, 40, 40))
            setBackgroundColor(Color.TRANSPARENT)
            setOnClickListener {
                web.evaluateJavascript("document.querySelector('[data-section=\\\"$section\\\"]')?.click();window.scrollTo(0,0)", null)
            }
        }
        nav.addView(button, LinearLayout.LayoutParams(0, -1, 1f))
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