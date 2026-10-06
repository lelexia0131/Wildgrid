!include "nsDialogs.nsh"
!include "MUI2.nsh"

!ifndef BUILD_UNINSTALLER
Var desktopShortcutCheckbox
Var desktopShortcutChoice

!macro customInit
  StrCpy $desktopShortcutChoice ${BST_CHECKED}
!macroend

!macro customPageAfterChangeDir
  Page custom ShortcutOptionsPage ShortcutOptionsLeave
!macroend

Function ShortcutOptionsPage
  !insertmacro MUI_HEADER_TEXT "快捷方式" "选择是否在桌面创建野格快捷方式。"
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateCheckbox} 0 12u 100% 16u "创建桌面快捷方式"
  Pop $desktopShortcutCheckbox
  ${NSD_SetState} $desktopShortcutCheckbox $desktopShortcutChoice
  nsDialogs::Show
FunctionEnd

Function ShortcutOptionsLeave
  ${NSD_GetState} $desktopShortcutCheckbox $desktopShortcutChoice
FunctionEnd

!macro customInstall
  ${If} $desktopShortcutChoice != ${BST_CHECKED}
    Delete "$newDesktopLink"
    System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
  ${EndIf}
!macroend
!endif
