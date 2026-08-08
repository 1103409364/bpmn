import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. 检查是否存在 package.json 和 package-lock.json
if (!fs.existsSync('package.json')) {
  console.error('❌ 未找到 package.json');
  process.exit(1);
}
if (!fs.existsSync('package-lock.json')) {
  console.error('❌ 未找到 package-lock.json，请先在联网机器运行 npm install');
  process.exit(1);
}

// 2. 创建输出目录 pkgs
const outputDir = path.join(__dirname, 'pkgs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 3. 读取 package-lock.json 打包所有依赖（包含子依赖）
const lockFile = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const packages = lockFile.packages || {};

console.log('🚀 1/2 开始打包所有依赖项为 .tgz 离线包...');

let count = 0;
Object.keys(packages).forEach(pkgPath => {
  if (!pkgPath) return; // 跳过根目录
  const pkgName = pkgPath.replace(/^node_modules\//, '');
  
  try {
    console.log(`  📦 打包: ${pkgName}`);
    execSync(`npm pack ${pkgName}`, { cwd: outputDir, stdio: 'ignore' });
    count++;
  } catch (err) {
    console.error(`  ⚠️ 打包失败: ${pkgName}`);
  }
});

console.log(`\n✅ 离线包导出完成！共打包 ${count} 个 .tgz 文件至 ./pkgs 目录\n`);

// 4. 自动匹配并更新 package.json 中的依赖路径
console.log('📝 2/2 开始更新 package.json 中的依赖路径...');

const pkgJsonPath = path.join(__dirname, 'package.json');
const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
const tgzFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.tgz'));

// 匹配并替换依赖版本的函数
function updateDeps(depsObj) {
  if (!depsObj) return;

  Object.keys(depsObj).forEach(depName => {
    // 处理带作用域的包，如 @bpmn-io/element-template-chooser -> bpmn-io-element-template-chooser
    const sanitizedName = depName.replace(/^@/, '').replace(/\//g, '-');
    
    // 寻找以该包名开头的 .tgz 文件
    const matchedTgz = tgzFiles.find(file => {
      return file.startsWith(`${sanitizedName}-`);
    });

    if (matchedTgz) {
      const relativePath = `file:./pkgs/${matchedTgz}`;
      console.log(`  🔄 ${depName}: "${depsObj[depName]}"  =>  "${relativePath}"`);
      depsObj[depName] = relativePath;
    } else {
      console.warn(`  ⚠️ 未找到 ${depName} 对应的 .tgz 文件，保持原样`);
    }
  });
}

// 替换主依赖和开发依赖
updateDeps(pkgJson.dependencies);
updateDeps(pkgJson.devDependencies);

// 写回 package.json
fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n', 'utf8');

console.log('\n🎉 处理完成！package.json 现已全部指向 ./pkgs/ 下的离线 .tgz 包。');