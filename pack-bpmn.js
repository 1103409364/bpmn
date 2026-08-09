import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. 指定需要离线化的 5 个目标包
const targetPackageNames = [
  'bpmn-auto-layout',
  'bpmn-js',
  'bpmn-js-i18n-zh',
  'diagram-js-accordion-palette',
  'diagram-js-grid'
];

// 2. 补充 BPMN 生态底层所有核心子包关键字
const subDepKeywords = [
  'diagram-js',
  'bpmn-moddle',
  'min-dash',
  'min-dom',
  'tiny-svg',
  'moddle',
  'inherits',
  'domify',
  'didi',
  'object-refs',
  'path-intersection',
  'saxen',
  'ids',
  'clsx',
  'component-event',
  'htm',
  'preact',
  'diagram-js-ui',
  'diagram-js-direct-editing'
];

if (!fs.existsSync('package-lock.json')) {
  console.error('❌ 未找到 package-lock.json，请先在联网环境运行 npm install');
  process.exit(1);
}

const outputDir = path.join(__dirname, 'pkgs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const lockFile = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const packages = lockFile.packages || {};

console.log('🚀 1/2 开始离线化指定的 BPMN 包及其核心子依赖...');

let count = 0;
// 使用 Set 存储纯包名，自动过滤重复项和嵌套路径
const uniquePackages = new Set();

Object.keys(packages).forEach(pkgPath => {
  if (!pkgPath) return; // 跳过根项目

  // 从路径中提取真实的 NPM 包名
  // 处理带作用域的包（如 @bpmn-io/diagram-js-ui）以及普通包
  const parts = pkgPath.split('node_modules/').filter(Boolean);
  const realPkgName = parts[parts.length - 1];

  if (!realPkgName) return;

  // 判断是否属于目标包或子依赖
  const isDirectTarget = targetPackageNames.includes(realPkgName);
  const isSubDep = subDepKeywords.some(kw => realPkgName.toLowerCase().includes(kw));

  if (isDirectTarget || isSubDep) {
    uniquePackages.add(realPkgName);
  }
});

// 执行打包
uniquePackages.forEach(pkgName => {
  try {
    console.log(`  📦 打包离线文件: ${pkgName}`);
    execSync(`npm pack ${pkgName}`, { cwd: outputDir, stdio: 'ignore' });
    count++;
  } catch (err) {
    console.error(`  ⚠️ 打包失败: ${pkgName}`);
  }
});

console.log(`\n✅ 导出完成！共成功打包 ${count} 个独立依赖包至 ./pkgs 目录\n`);

// 3. 仅更新 package.json 中这 5 个包的配置
console.log('📝 2/2 开始更新 package.json 配置...');

const pkgJsonPath = path.join(__dirname, 'package.json');
const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
const tgzFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.tgz'));

function updateSpecifiedDeps(depsObj) {
  if (!depsObj) return;

  targetPackageNames.forEach(depName => {
    if (depsObj[depName]) {
      const sanitizedName = depName.replace(/^@/, '').replace(/\//g, '-');
      const matchedTgz = tgzFiles.find(file => file.startsWith(`${sanitizedName}-`));

      if (matchedTgz) {
        const relativePath = `file:./pkgs/${matchedTgz}`;
        console.log(`  🔄 ${depName}: "${depsObj[depName]}"  =>  "${relativePath}"`);
        depsObj[depName] = relativePath;
      }
    }
  });
}

updateSpecifiedDeps(pkgJson.dependencies);
updateSpecifiedDeps(pkgJson.devDependencies);

fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n', 'utf8');

console.log('\n🎉 处理完成！所有包含的离线包已无报错打包完毕。');