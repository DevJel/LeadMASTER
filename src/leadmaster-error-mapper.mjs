const SUPPORT_EMAIL = "cs@leadmaster.jelvan.space";

export const CUSTOMER_ERROR_GUIDE = [
  { code:"LM-USR-1001", category:"Account Handling", title:"Those sign-in details do not match", what:"The email address or password was not accepted.", steps:["Check the email address for typing mistakes.","Enter your sign-in details again.","Use the account recovery option if you cannot remember them."] },
  { code:"LM-USR-1002", category:"Account Handling", title:"Your session has expired", what:"For your protection, you need to sign in again.", steps:["Return to the sign-in page.","Sign in with your account details.","Reopen the page you were working on."] },
  { code:"LM-USR-1003", category:"Account Handling", title:"This sign-in link has expired", what:"The sign-in or verification link is no longer active.", steps:["Request a new link from the sign-in page.","Open the newest message in your inbox.","Use the link before it expires."] },
  { code:"LM-USR-1004", category:"Account Handling", title:"Confirm your email address", what:"Your email address still needs to be confirmed.", steps:["Open the confirmation message sent to your email.","Select the confirmation link.","Return to LeadMASTER and sign in again."] },
  { code:"LM-USR-1005", category:"Account Handling", title:"The verification details do not match", what:"The code or approval did not match this sign-in attempt.", steps:["Request a fresh verification code.","Enter the newest code exactly as shown.","Check your device time and try again."] },
  { code:"LM-USR-1006", category:"Account Handling", title:"Workspace access is currently inactive", what:"This workspace is not currently available to your account.", steps:["Ask your workspace owner to check your access.","Confirm that your membership is still active.","Contact support if the owner needs help."] },
  { code:"LM-USR-1007", category:"Account Handling", title:"You do not have access to this action", what:"Your current role does not include permission for this change.", steps:["Ask a workspace administrator to review your role.","Explain which page or action you need to use.","Try again after your access is updated."] },
  { code:"LM-USR-1008", category:"Account Handling", title:"Please wait before trying to sign in again", what:"There have been too many sign-in attempts in a short time.", steps:["Pause briefly before trying again.","Check that your sign-in details are correct.","Contact support if you still cannot sign in."] },

  { code:"LM-USR-2001", category:"Connections & Sync", title:"You appear to be offline", what:"Your device cannot currently reach the internet.", steps:["Reconnect to Wi-Fi or mobile data.","Open another website to check the connection.","Return to LeadMASTER and retry the action."] },
  { code:"LM-USR-2002", category:"Connections & Sync", title:"Your connection was interrupted", what:"The connection dropped before your change could be confirmed.", steps:["Check whether the change already appears before trying again.","Reconnect to a stable network.","Retry once the connection is steady."] },
  { code:"LM-USR-2003", category:"Connections & Sync", title:"Reconnect this service", what:"A connected service needs you to sign in or approve access again.", steps:["Open Settings and find the affected connection.","Choose Connect or Reconnect.","Complete the service's approval steps and retry."] },
  { code:"LM-USR-2004", category:"Connections & Sync", title:"Your browser blocked a new tab", what:"Your browser prevented the requested page from opening.", steps:["Allow pop-ups for the LeadMASTER site.","Select the app link again.","Check whether the page opened in another tab."] },
  { code:"LM-USR-2005", category:"Connections & Sync", title:"We could not complete the connection", what:"The requested service could not be reached just now.", steps:["Check your internet connection.","Confirm the connected service is available.","Try again in a moment."] },

  { code:"LM-USR-3001", category:"Email & Contacts", title:"A required detail is missing", what:"Please complete the fields marked as required.", steps:["Review the form for highlighted fields.","Enter the missing information.","Save again."] },
  { code:"LM-USR-3002", category:"Email & Contacts", title:"Check the email address format", what:"The email address needs to look like name@example.com.", steps:["Remove extra spaces.","Check for a missing @ sign or domain.","Enter the corrected address and try again."] },
  { code:"LM-USR-3003", category:"Email & Contacts", title:"This contact may already exist", what:"A contact with the same email address is already in your list.", steps:["Search Contacts using the email address.","Open the existing contact to review it.","Update that record instead of adding another."] },
  { code:"LM-USR-3004", category:"Email & Contacts", title:"This file type is not supported", what:"The selected file cannot be used here.", steps:["Choose a supported document or image format.","Save the file in that format if needed.","Attach it again."] },
  { code:"LM-USR-3005", category:"Email & Contacts", title:"This file is too large", what:"The selected file is larger than the allowed size.", steps:["Choose a smaller file.","Compress the file or reduce image size.","Try attaching it again."] },
  { code:"LM-USR-3006", category:"Email & Contacts", title:"Your email content is empty", what:"Add some content before sending or exporting this template.", steps:["Enter the message text or add an email section.","Preview the result.","Save or send again."] },
  { code:"LM-USR-3007", category:"Email & Contacts", title:"Check the date and time", what:"The date or time you entered is not valid for this action.", steps:["Choose a date from the calendar.","Select a valid time.","Check that the chosen time is still in the future when scheduling."] },
  { code:"LM-USR-3008", category:"Email & Contacts", title:"Add at least one recipient", what:"An email needs a valid recipient before it can be queued.", steps:["Enter one or more email addresses in To.","Check each address for typing mistakes.","Try sending again."] },

  { code:"LM-USR-4001", category:"Limits", title:"Your daily sending allowance has been reached", what:"Your workspace has used its current daily email allowance.", steps:["Wait until the allowance renews.","Review the recipients and remove any messages you do not need.","Ask your workspace administrator to review the sending allowance."] },
  { code:"LM-USR-4002", category:"Limits", title:"Your workspace storage is full", what:"There is not enough available space to save this item.", steps:["Remove files or records you no longer need, if permitted.","Empty the relevant trash or archive area if appropriate.","Ask your workspace administrator to review storage."] },
  { code:"LM-USR-4003", category:"Limits", title:"Choose a valid currency pair", what:"One of the selected currencies is not available for this conversion.", steps:["Choose a currency from the list.","Select a different source or destination currency.","Try the conversion again."] },
  { code:"LM-USR-4004", category:"Limits", title:"Check the amount you entered", what:"Enter a valid number to complete this calculation.", steps:["Use digits and a decimal point if needed.","Remove letters or other symbols.","Enter the amount again."] },
  { code:"LM-USR-4005", category:"Limits", title:"This send is larger than the current allowance", what:"The number of recipients or messages is above the permitted amount for one action.", steps:["Split the recipients into smaller groups.","Review the number of selected messages.","Ask your workspace administrator if you need a larger allowance."] }
];

const SYSTEM_FALLBACK = "We couldn't complete this action due to a system issue (Error 342322). Please contact the LeadMASTER support team for further assistance at " + SUPPORT_EMAIL + ".";

function textOf(error) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const value = error;
    return [value.code, value.errorCode, value.message, value.error, value.name].filter(x => typeof x === "string" || typeof x === "number").join(" ");
  }
  return "";
}

export function errorByCode(code) {
  return CUSTOMER_ERROR_GUIDE.find(item => item.code === code) || null;
}

export function mapLeadMasterError(error, context = "") {
  const raw = textOf(error);
  const normalized = (context + " " + raw).toLowerCase();
  const suppliedCode = raw.match(/LM-USR-\d{4}/)?.[0];
  let code = suppliedCode || "";
  if (code) { const supplied = errorByCode(code); if (supplied) return { code: supplied.code, title: supplied.title, message: supplied.code + " — " + supplied.what + " " + supplied.steps[0] }; }
  if (typeof navigator !== "undefined" && navigator.onLine === false) code = "LM-USR-2001";
  else if (/popup|pop-up|new tab|blocked.*window/.test(normalized)) code = "LM-USR-2004";
  else if (/too many.*(sign.in|login|attempt)|sign.in.*attempts/.test(normalized)) code = "LM-USR-1008";
  else if (/invalid credentials|incorrect password|wrong password|password.*incorrect/.test(normalized)) code = "LM-USR-1001";
  else if (/expired.*(verification|sign.in|login).*link|verification link.*expired/.test(normalized)) code = "LM-USR-1003";
  else if (/duplicate|already exists|unique constraint/.test(normalized)) code = "LM-USR-3003";
  else if (/invalid.*email|email.*invalid|recipient.*format/.test(normalized)) code = "LM-USR-3002";
  else if (/required|missing.*field|name and email|add a recipient/.test(normalized)) code = "LM-USR-3001";
  else if (/empty.*(template|body)|template.*empty/.test(normalized)) code = "LM-USR-3006";
  else if (/currency.*provider|exchange.*unavailable/.test(normalized)) code = "LM-USR-2005";
  else if (/currency|exchange pair/.test(normalized)) code = "LM-USR-4003";
  else if (/calculation|invalid amount|not a number/.test(normalized)) code = "LM-USR-4004";
  else if (/quota|storage.*full|storage.*limit/.test(normalized)) code = "LM-USR-4002";
  else if (/daily.*(limit|allowance)|sending.*limit|quota.*send|too many recipients/.test(normalized)) code = "LM-USR-4001";
  else if (/permission|forbidden|not allowed|insufficient role/.test(normalized)) code = "LM-USR-1007";
  else if (/suspend|inactive workspace|workspace.*inactive/.test(normalized)) code = "LM-USR-1006";
  else if (/unverified|verify.*email/.test(normalized)) code = "LM-USR-1004";
  else if (/verification.*(mismatch|invalid)|otp|two.factor|2fa/.test(normalized)) code = "LM-USR-1005";
  else if (/expired.*(session|sign.in|link)|unauthorized|http\s*401/.test(normalized)) code = "LM-USR-1002";
  else if (/network|fetch failed|failed to fetch|networkerror|err_network|connection.*(lost|interrupted)|internet.*connection/.test(normalized)) code = "LM-USR-2002";
  else if (/integration|authorization.*expired|reconnect/.test(normalized)) code = "LM-USR-2003";
  else if (/file.*(type|format)|unsupported.*file/.test(normalized)) code = "LM-USR-3004";
  else if (/file.*(large|size)|too large/.test(normalized)) code = "LM-USR-3005";
  else if (/date|time.*invalid|future/.test(normalized)) code = "LM-USR-3007";
  else if (/recipient|to field/.test(normalized)) code = "LM-USR-3008";
  else if (/batch size|too many messages.*one action|recipient count.*limit/.test(normalized)) code = "LM-USR-4005";
  const entry = errorByCode(code);
  if (entry) return { code: entry.code, title: entry.title, message: entry.code + " — " + entry.what + " " + entry.steps[0] };
  return { code: "342322", title: "We couldn't complete this action", message: SYSTEM_FALLBACK };
}

export { SYSTEM_FALLBACK };
