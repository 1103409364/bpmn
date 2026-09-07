<script setup>
import { computed } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { EditorView } from 'codemirror'
import { xml } from '@codemirror/lang-xml'
import { javascript } from '@codemirror/lang-javascript'
import { StreamLanguage } from '@codemirror/language'
import { groovy } from '@codemirror/legacy-modes/mode/groovy'

// 基于 CodeMirror 6 (vue-codemirror) 的通用代码编辑器组件
const props = defineProps({
  // 双向绑定的代码内容
  modelValue: { type: String, default: '' },
  // 语言：xml / js / json / groovy
  language: { type: String, default: 'xml' },
  readOnly: { type: Boolean, default: false },
  placeholder: { type: String, default: '在此输入内容…' },
  height: { type: String, default: '300px' }
})

const emit = defineEmits(['update:modelValue'])

const code = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const baseSetup = { lineNumbers: true, foldGutter: true, autocompletion: true }

// 按语言切换对应的语法扩展
const extensions = computed(() => {
  const langExt = {
    xml: xml(),
    js: javascript(),
    json: javascript({ json: true }),
    groovy: StreamLanguage.define(groovy)
  }[props.language]
  return [langExt, EditorView.lineWrapping]
})
</script>

<template>
  <Codemirror
    v-model="code"
    :style="{ height, border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }"
    :extensions="extensions"
    :read-only="readOnly"
    :disabled="readOnly"
    :basic-setup="baseSetup"
    :placeholder="placeholder"
  />
</template>