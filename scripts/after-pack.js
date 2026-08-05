const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function embedWindowsIcon(context) {
    if (context.electronPlatformName !== 'win32') return;

    const projectDir = context.packager.info.projectDir;
    const rceditPath = path.join(projectDir, 'node_modules/electron-winstaller/vendor/rcedit.exe');
    const iconPath = path.join(projectDir, 'public/icon.ico');
    const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);

    if (!fs.existsSync(rceditPath)) {
        throw new Error(`Unable to embed app icon: rcedit was not found at ${rceditPath}`);
    }

    execFileSync(rceditPath, [
        exePath,
        '--set-icon',
        iconPath,
        '--set-version-string',
        'CompanyName',
        'Ab Learning',
        '--set-version-string',
        'FileDescription',
        'Air Drop Text',
        '--set-version-string',
        'ProductName',
        'Air Drop Text',
        '--set-version-string',
        'OriginalFilename',
        'Air Drop Text.exe'
    ], { stdio: 'inherit' });
}

exports.default = async function afterPack(context) {
    embedWindowsIcon(context);

    const localesDir = path.join(context.appOutDir, 'locales');
    const keepLocales = new Set(['en-US.pak']);

    if (!fs.existsSync(localesDir)) return;

    for (const fileName of fs.readdirSync(localesDir)) {
        if (keepLocales.has(fileName)) continue;
        fs.rmSync(path.join(localesDir, fileName), { force: true });
    }
};
