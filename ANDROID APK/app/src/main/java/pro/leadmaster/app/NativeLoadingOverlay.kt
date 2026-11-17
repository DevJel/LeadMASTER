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
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.border

private val LeadMasterOrange = Color(0xFFE9762B)
private val LeadMasterInk = Color(0xFF171717)
private val LeadMasterMuted = Color(0xFF70706D)
private val LeadMasterCanvas = Color(0xFFF7F7F5)

@Composable
fun NativeLoadingOverlay(
    progress: Int,
    failed: Boolean,
    onRetry: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(LeadMasterCanvas.copy(alpha = 0.88f)),
        contentAlignment = Alignment.Center
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 28.dp)
                .border(1.dp, Color(0xFFE6E4E0), RoundedCornerShape(28.dp)),
            shape = RoundedCornerShape(28.dp),
            color = Color.White,
            tonalElevation = 2.dp,
            shadowElevation = 12.dp
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 26.dp, vertical = 30.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Image(
                    painter = painterResource(id = R.drawable.ic_leadmaster),
                    contentDescription = "LeadMASTER",
                    modifier = Modifier.size(58.dp)
                )
                Spacer(Modifier.height(20.dp))
                Text(
                    text = if (failed) "Connection interrupted" else "LeadMASTER",
                    color = LeadMasterInk,
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
                        progress = { progress.coerceIn(0, 100) / 100f },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(4.dp),
                        color = LeadMasterOrange,
                        trackColor = Color(0xFFF1E7DF)
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
