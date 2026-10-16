#define MyAppName "CPS Universal Downloader Premium"
#define MyAppVersion "1.2.4"
#define MyAppPublisher "Chuob Piseth"
#define MyAppExeName "CPSUniversalDownloader.exe"

[Setup]
AppId={{9F5AF89D-6A77-4E73-B74F-8C3C1F015D39}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\CPS Universal Downloader
DefaultGroupName=CPS Universal Downloader
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=..\release
OutputBaseFilename=CPS-Universal-Downloader-v{#MyAppVersion}-Setup
SetupIconFile=..\assets\app_icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=force
RestartApplications=no
SetupLogging=yes
VersionInfoVersion={#MyAppVersion}.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription=CPS Universal Downloader Premium installer
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "..\build-v1.2.4\CPSUniversalDownloader.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\CPS Universal Downloader Premium"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\CPS Universal Downloader Premium"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch CPS Universal Downloader Premium"; Flags: nowait postinstall
