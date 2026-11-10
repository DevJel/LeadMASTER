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
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Insights
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarDefaults
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle

private data class AppDestination(
    val id: String,
    val label: String,
    val icon: ImageVector
)

private val appDestinations = listOf(
    AppDestination("home", "Home", Icons.Outlined.Home),
    AppDestination("emails", "Emails", Icons.Outlined.Email),
    AppDestination("audience", "Audience", Icons.Outlined.Groups),
    AppDestination("metrics", "Metrics", Icons.Outlined.Insights),
    AppDestination("profile", "Profile", Icons.Outlined.Person)
)

class MainActivity : ComponentActivity() {
    private val workspaceViewModel: WorkspaceViewModel by viewModels()
    private var webView: WebView? = null
    private val channelId = "leadmaster_updates"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        createNotificationChannel()

        setContent {
            val uiState by workspaceViewModel.uiState.collectAsStateWithLifecycle()
            val dark = isSystemInDarkTheme()
            val colors = if (dark) {
                darkColorScheme(
                    primary = Color.White,
                    onPrimary = Color.Black,
                    surface = Color(0xFF151515),
                    onSurface = Color(0xFFF5F5F5),
                    surfaceContainer = Color(0xFF222222),
                    onSurfaceVariant = Color(0xFFB5B5B5)
                )
            } else {
                lightColorScheme(
                    primary = Color(0xFF111111),
                    onPrimary = Color.White,
                    surface = Color.White,
                    onSurface = Color(0xFF111111),
                    surfaceContainer = Color(0xFFF2F2F2),
                    onSurfaceVariant = Color(0xFF6B6B6B)
                )
            }
            val compact = LocalConfiguration.current.screenWidthDp < 600

            MaterialTheme(colorScheme = colors) {
                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    containerColor = colors.surface,
                    bottomBar = {
                        if (uiState.showNavigation && compact) {
                            LeadMasterNavigationBar(
                                selected = uiState.selectedSection,
                                onSelect = ::navigateToSection
                            )
                        }
                    }
                ) { contentPadding ->
                    if (uiState.showNavigation && !compact) {
                        Row(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(contentPadding),
                            horizontalArrangement = Arrangement.Start
                        ) {
                            NavigationRail(
                                containerColor = colors.surface,
                                contentColor = colors.onSurface
                            ) {
                                appDestinations.forEach { destination ->
                                    NavigationRailItem(
                                        selected = uiState.selectedSection == destination.id,
                                        onClick = { navigateToSection(destination.id) },
                                        icon = { Icon(destination.icon, contentDescription = destination.label) },
                                        label = { Text(destination.label) },
                                        alwaysShowLabel = true
                                    )
                                }
                            }
                            WorkspaceWebView(
                                modifier = Modifier.weight(1f).fillMaxHeight(),
                                savedState = savedInstanceState
                            )
                        }
                    } else {
                        WorkspaceWebView(
                            modifier = Modifier.fillMaxSize().padding(contentPadding),
                            savedState = savedInstanceState
                        )
                    }
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val web = webView
                if (web?.url?.contains("/dashboard") == true) {
                    if (workspaceViewModel.uiState.value.selectedSection != "home") {
                        navigateToSection("home")
                    } else if (web.canGoBack()) {
                        web.goBack()
                    } else {
                        web.evaluateJavascript("location.href='/login.html'", null)
                    }
                } else if (web?.canGoBack() == true) {
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

    @Composable
    private fun LeadMasterNavigationBar(
        selected: String,
        onSelect: (String) -> Unit
    ) {
        NavigationBar(
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.onSurface,
            tonalElevation = 0.dp,
            windowInsets = NavigationBarDefaults.windowInsets
        ) {
            appDestinations.forEach { destination ->
                NavigationBarItem(
                    selected = selected == destination.id,
                    onClick = { onSelect(destination.id) },
                    icon = { Icon(destination.icon, contentDescription = destination.label) },
                    label = { Text(destination.label) },
                    alwaysShowLabel = true,
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = MaterialTheme.colorScheme.onSurface,
                        selectedTextColor = MaterialTheme.colorScheme.onSurface,
                        indicatorColor = MaterialTheme.colorScheme.surfaceContainer,
                        unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                )
            }
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
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.safeBrowsingEnabled = true
            CookieManager.getInstance().setAcceptCookie(true)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
            addJavascriptInterface(NativeBridge(), "LeadMasterNative")
            webChromeClient = WebChromeClient()
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
                    workspaceViewModel.onPageFinished(url)
                    view?.evaluateJavascript(
                        """
                        (function(){
                          document.documentElement.dataset.lmNativeApp='true';
                          document.documentElement.style.setProperty('--lm-native-app','1');
                          if(!window.__lmNativeSectionListener){
                            window.__lmNativeSectionListener=true;
                            document.addEventListener('click',function(event){
                              if(event.defaultPrevented)return;
                              var button=event.target.closest('.tab-link,.bottom-tab');
                              if(button&&window.LeadMasterNative){
                                window.LeadMasterNative.sectionChanged((button.textContent||'').trim());
                              }
                            },false);
                          }
                          return document.querySelector('.bottom-tab.active')?.textContent?.trim()
                            ||document.querySelector('.tab-link.active')?.textContent?.trim()
                            ||'Home';
                        })();
                        """.trimIndent()
                    ) { value ->
                        workspaceViewModel.onSectionChanged(value?.trim('"') ?: "Home")
                    }
                }

                override fun doUpdateVisitedHistory(view: WebView?, url: String?, isReload: Boolean) {
                    super.doUpdateVisitedHistory(view, url, isReload)
                    workspaceViewModel.onPageFinished(url)
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

    private fun navigateToSection(section: String) {
        if (section !in WorkspaceViewModel.DESTINATIONS) return
        workspaceViewModel.selectSection(section)
        val label = when (section) {
            "home" -> "Home"
            "emails" -> "Emails"
            "audience" -> "Audience"
            "metrics" -> "Metrics"
            "profile" -> "Profile"
            else -> return
        }
        val script = "(function(){var label=" + org.json.JSONObject.quote(label) + ";" +
            "var buttons=Array.from(document.querySelectorAll('.tab-link,.bottom-tab'));" +
            "var target=buttons.find(function(button){return (button.textContent||'').trim().toLowerCase().startsWith(label.toLowerCase());});" +
            "if(target){target.click();var scroller=document.querySelector('.app-scroll');" +
            "if(scroller)scroller.scrollTo({top:0,behavior:'auto'});else window.scrollTo({top:0,behavior:'auto'});return true;}return false;})();"
        webView?.evaluateJavascript(script, null)
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
        fun sectionChanged(label: String?) {
            runOnUiThread { workspaceViewModel.onSectionChanged(label) }
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

    override fun onSaveInstanceState(outState: Bundle) {
        webView?.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        webView?.let { view ->
            view.removeJavascriptInterface("LeadMasterNative")
            view.stopLoading()
            view.destroy()
        }
        webView = null
        super.onDestroy()
    }
}
