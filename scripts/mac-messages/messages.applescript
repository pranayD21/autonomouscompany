on run argv
  set modeName to item 1 of argv
  tell application "Messages"
    if modeName is "inspect" then
      set smsCount to count of (accounts whose service type is SMS)
      set imessageCount to count of (accounts whose service type is iMessage)
      return (smsCount as text) & "," & (imessageCount as text)
    end if
    set selectedId to item 2 of argv
    set wantedTransport to item 3 of argv
    set selectedAccount to account id selectedId
    if not (enabled of selectedAccount) then error "Configured account is disabled" number 19001
    if wantedTransport is "sms" then
      if service type of selectedAccount is not SMS then error "Configured account is not SMS" number 19002
    else if wantedTransport is "imessage" then
      if service type of selectedAccount is not iMessage then error "Configured account is not iMessage" number 19002
    else
      error "Unsupported transport" number 19002
    end if
    if modeName is "check" then return "ready"
    if modeName is not "send" then error "Unsupported command" number 19003
    set recipientHandle to item 4 of argv
    set messageBody to item 5 of argv
    set recipientParticipant to participant recipientHandle of selectedAccount
    send messageBody to recipientParticipant
    return "submitted"
  end tell
end run
