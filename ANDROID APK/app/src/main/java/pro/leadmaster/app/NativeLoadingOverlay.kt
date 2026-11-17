package pro.leadmaster.app

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.border

private val LeadMasterOrange = Color(0xFFE9762B)
private val LeadMasterInk = Color(0xFFF5F5F5)
private val LeadMasterMuted = Color(0xFFB8B8B8)
private val LeadMasterCanvas = Color(0xFF555555)

@Composable
fun NativeLoadingOverlay(
    progress: Int,
    failed: Boolean,
    onRetry: () -> Unit
) {
    val pulse = rememberInfiniteTransition(label = "leadmaster-loading-pulse")
    val logoScale by pulse.animateFloat(
        initialValue = 0.96f,
        targetValue = 1.04f,
        animationSpec = infiniteRepeatable(tween(1100), repeatMode = RepeatMode.Reverse),
        label = "leadmaster-logo-pulse"
    )
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.linearGradient(listOf(Color(0xCC777777), Color(0xDD3E3E3E), Color(0xCC777777)))),
        contentAlignment = Alignment.Center
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 28.dp)
                .border(1.dp, Color(0xFF454545), RoundedCornerShape(28.dp)),
            shape = RoundedCornerShape(28.dp),
            color = Color(0xFF111111),
            tonalElevation = 5.dp,
            shadowElevation = 24.dp
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 26.dp, vertical = 30.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Image(
                    painter = painterResource(id = R.drawable.ic_leadmaster),
                    contentDescription = "LeadMASTER",
                    modifier = Modifier.size(58.dp).graphicsLayer(scaleX = logoScale, scaleY = logoScale)
                )
                Spacer(Modifier.height(20.dp))
                Text(
                    text = if (failed) "Connection interrupted" else "LeadMASTER",
                    color = Color.White,
                    fontSize = 21.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(7.dp))
                Text(
                    text = if (failed) {
                        "Your workspace couldn't be reached. Check your connection and try again."
                    } else {
                        "Preparing your secure workspace…"
                    },
                    color = LeadMasterMuted,
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(24.dp))
                if (failed) {
                    Button(
                        onClick = onRetry,
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = LeadMasterOrange,
                            contentColor = Color.White
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Try again", fontWeight = FontWeight.SemiBold)
                    }
                } else {
                    LinearProgressIndicator(
                        progress = progress.coerceIn(0, 100) / 100f,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(4.dp),
                        color = LeadMasterOrange,
                        trackColor = Color(0xFF393939)
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        text = if (progress > 0) "Loading workspace · $progress%" else "Connecting securely",
                        color = LeadMasterMuted,
                        fontSize = 12.sp
                    )
                }
            }
        }
    }
}
