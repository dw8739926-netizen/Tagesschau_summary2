# Dieses Skript fügt Node.js dauerhaft zu deinem Benutzer-Pfad hinzu.
$nodejsPath = "C:\Program Files\nodejs"
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")

if ($currentPath -notlike "*$nodejsPath*") {
    $newPath = $currentPath + ";" + $nodejsPath
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "Erfolg: Node.js wurde dauerhaft zu deinem Pfad hinzugefügt." -ForegroundColor Green
    Write-Host "Bitte starte VS Code oder dein Terminal neu!" -ForegroundColor Cyan
} else {
    Write-Host "Node.js ist bereits in deinem Pfad vorhanden." -ForegroundColor Yellow
}
