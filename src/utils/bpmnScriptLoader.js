const DEFAULT_BPMN_STYLE_URLS = [
  '/js/bpmn-js/assets/diagram-js.css',
  '/js/bpmn-js/assets/bpmn-js.css',
  '/js/bpmn-js/assets/bpmn-font/css/bpmn-embedded.css',
  '/js/diagram-js-accordion-palette/assets/index.css'
]

const DEFAULT_BPMN_SCRIPT_URLS = [
  '/js/bpmn-js/bpmn-modeler.development.js',
  '/js/diagram-js-accordion-palette/diagram-js-accordion-palette.umd.js'
]

function getWindowGlobal(names) {
  if (typeof window === 'undefined') {
    return null
  }
  for (const name of names) {
    if (name && window[name] != null) {
      return window[name]
    }
  }
  return null
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      return reject(new Error('Document is not available'))
    }

    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      if (existing.getAttribute('data-loaded') === 'true') {
        return resolve()
      }
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)))
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = false
    script.onload = () => {
      script.setAttribute('data-loaded', 'true')
      resolve()
    }
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

function loadStyle(href) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      return reject(new Error('Document is not available'))
    }

    const existing = document.querySelector(`link[href="${href}"]`)
    if (existing) {
      return resolve()
    }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.onload = () => resolve()
    link.onerror = () => reject(new Error(`Failed to load stylesheet: ${href}`))
    document.head.appendChild(link)
  })
}

export async function ensureBpmnEnvironment() {
  if (typeof window === 'undefined') {
    return
  }

  if (getWindowGlobal(['BpmnJS', 'BpmnModeler'])) {
    return
  }

  const config = window.__BPMN_SCRIPT_FALLBACK__ || {}
  const styles = config.styles || DEFAULT_BPMN_STYLE_URLS
  const scripts = config.scripts || DEFAULT_BPMN_SCRIPT_URLS

  await Promise.all([
    ...styles.map(loadStyle),
    ...scripts.map(loadScript)
  ])

  if (!getWindowGlobal(['BpmnJS', 'BpmnModeler'])) {
    throw new Error('bpmn-js 未加载，请确认 index.html 中已通过 script 标签引入 runtime bundle 或配置 window.__BPMN_SCRIPT_FALLBACK__')
  }
}

export function getBpmnGlobals() {
  const BpmnModelerClass = getWindowGlobal(['BpmnJS', 'BpmnModeler'])
  const camundaModdle = getWindowGlobal(['camundaBpmnModdle', 'CamundaBpmnModdle', 'camundaModdle', 'CamundaModdle'])
  const AccordionPaletteModule = getWindowGlobal([
    'DiagramJsAccordionPalette',
    'diagramJsAccordionPalette',
    'AccordionPaletteModule',
    'diagramJsAccordionPaletteModule'
  ])
  const gridModule = getWindowGlobal(['DiagramJsGrid', 'diagramJsGrid', 'GridModule'])

  return {
    BpmnModelerClass,
    camundaModdle,
    AccordionPaletteModule,
    gridModule
  }
}

export function getBpmnAutoLayoutProcess() {
  const module = getWindowGlobal(['bpmnAutoLayout', 'BpmnAutoLayout', 'bpmn-auto-layout'])
  return module?.layoutProcess || null
}
