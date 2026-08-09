import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. 检查 package.json 和 package-lock.json
if (!fs.existsSync('package.json')) {
  console.error('❌ 未找到 package.json');
  process.exit(1);
}
if (!fs.existsSync('package-lock.json')) {
  console.error('❌ 未找到 package-lock.json，请先在联网环境运行 npm install');
  process.exit(1);
}

// 2. 创建输出目录 pkgs
const outputDir = path.join(__dirname, 'pkgs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 3. 读取 package-lock.json 打包全量依赖
const lockFile = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const packages = lockFile.packages || {};

console.log('🚀 1/2 开始按锁定版本导出项目中的【全量】依赖包为 .tgz ...');

// 使用 Map 收集真实包名及其锁定的精确版本号，自动去除嵌套重复项
const packagesToPack = new Map();

Object.entries(packages).forEach(([pkgPath, pkgInfo]) => {
  if (!pkgPath) return; // 跳过根目录

  // 1. 提取真实包名（解决 nested node_modules 路径，如 node_modules/a/node_modules/b）
  const pathParts = pkgPath.split('node_modules/').filter(Boolean);
  const realPkgName = pathParts[pathParts.length - 1];

  if (!realPkgName || !pkgInfo.version) return;

  // 2. 收集包名与 exact version（例如 bpmn-js: 18.22.1）
  packagesToPack.set(realPkgName, pkgInfo.version);
});

let count = 0;
// 按照 exact version 打包，确保版本与 lockfile 严格一致
packagesToPack.forEach((version, pkgName) => {
  const targetSpec = `${pkgName}@${version}`;
  try {
    console.log(`  📦 打包离线文件: ${targetSpec}`);
    execSync(`npm pack ${targetSpec}`, { cwd: outputDir, stdio: 'ignore' });
    count++;
  } catch (err) {
    console.error(`  ⚠️ 打包失败: ${targetSpec}`);
  }
});

console.log(`\n✅ 导出完成！共打包 ${count} 个全量依赖包至 ./pkgs 目录\n`);

// 4. 自动匹配并更新 package.json 中的所有依赖路径
console.log('📝 2/2 开始更新 package.json 中的全量依赖路径...');

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
    const matchedTgz = tgzFiles.find(file => file.startsWith(`${sanitizedName}-`));

    if (matchedTgz) {
      const relativePath = `file:./pkgs/${matchedTgz}`;
      console.log(`  🔄 ${depName}: "${depsObj[depName]}"  =>  "${relativePath}"`);
      depsObj[depName] = relativePath;
    } else {
      console.warn(`  ⚠️ 未找到 ${depName} 对应的 .tgz 文件`);
    }
  });
}

// 替换 dependencies 和 devDependencies
updateDeps(pkgJson.dependencies);
updateDeps(pkgJson.devDependencies);

// 写回 package.json
fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n', 'utf8');

console.log('\n🎉 处理完成！项目 package.json 现已全部指向 ./pkgs/ 下的离线 .tgz 包。');