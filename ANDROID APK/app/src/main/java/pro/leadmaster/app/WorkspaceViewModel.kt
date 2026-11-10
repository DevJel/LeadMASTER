package pro.leadmaster.app

import android.net.Uri
import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class WorkspaceUiState(
    val showNavigation: Boolean = false,
    val selectedSection: String = "home"
)

/**
 * Holds immutable UI state for the native app shell.
 * Account data and email business rules remain on the authenticated LeadMASTER service.
 */
class WorkspaceViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(WorkspaceUiState())
    val uiState: StateFlow<WorkspaceUiState> = _uiState.asStateFlow()

    fun onPageFinished(url: String?) {
        val uri = runCatching { Uri.parse(url) }.getOrNull()
        val isTrustedOrigin = uri?.scheme == "https" &&
            uri.host == APP_HOST &&
            (uri.port == -1 || uri.port == 443) &&
            uri.userInfo == null
        if (!isTrustedOrigin) _uiState.update { it.copy(showNavigation = false) }
    }

    fun onWorkspaceReady(ready: Boolean) {
        _uiState.update { it.copy(showNavigation = ready) }
    }

    fun selectSection(section: String) {
        if (section in DESTINATIONS) {
            _uiState.update { it.copy(selectedSection = section) }
        }
    }

    fun onSectionChanged(label: String?) {
        val section = when (label.orEmpty().trim().lowercase()) {
            "home", "homepage", "overview", "dashboard" -> "home"
            "emails", "email" -> "emails"
            "audience", "audiences", "contacts" -> "audience"
            "metrics", "analytics" -> "metrics"
            "profile", "account", "settings" -> "profile"
            else -> null
        } ?: return
        selectSection(section)
    }

    companion object {
        const val APP_HOST = "leadmaster.jelvan.pro"
        val DESTINATIONS = setOf("home", "emails", "audience", "metrics", "profile")
        const val HOME_URL = "https://leadmaster.jelvan.pro/login.html"
    }
}
