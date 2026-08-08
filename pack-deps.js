import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取 package-lock.json (确保已经运行过 npm install)
if (!fs.existsSync('package-lock.json')) {
  console.error('❌ 未找到 package-lock.json，请先运行 npm install');
  process.exit(1);
}

const lockFile = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const packages = lockFile.packages || {};

const outputDir = path.join(__dirname, 'offline-pkgs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

console.log('🚀 开始导出所有依赖项为 .tgz 离线包...');

let count = 0;
Object.keys(packages).forEach(pkgPath => {
  if (!pkgPath) return; // 跳过根项目
  const pkgName = pkgPath.replace(/^node_modules\//, '');
  
  try {
    console.log(`📦 打包: ${pkgName}`);
    execSync(`npm pack ${pkgName}`, { cwd: outputDir, stdio: 'ignore' });
    count++;
  } catch (err) {
    console.error(`⚠️ 打包失败: ${pkgName}`);
  }
});

console.log(`\n✅ 导出完成！共打包 ${count} 个依赖包，存放在: ${outputDir}`);