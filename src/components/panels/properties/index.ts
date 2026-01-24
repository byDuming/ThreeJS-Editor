/**
 * 属性组件统一导出
 * 
 * 这些组件封装了 usePropertyBinding，简化属性面板的开发。
 * 通过 path 属性指定要绑定的数据路径，组件会自动处理数据的读取和更新。
 * 
 * @example
 * ```vue
 * <PropertyNumber path="transform.position[0]" label="X" :step="0.1" />
 * <PropertySwitch path="visible" />
 * <PropertyColor path="mesh.material.color" />
 * <PropertySelect path="mesh.material.side" :options="sideOptions" />
 * <PropertyVec3 path="transform.position" :step="0.1" />
 * ```
 */

export { default as PropertyNumber } from './PropertyNumber.vue'
export { default as PropertySwitch } from './PropertySwitch.vue'
export { default as PropertyColor } from './PropertyColor.vue'
export { default as PropertySelect } from './PropertySelect.vue'
export { default as PropertyVec3 } from './PropertyVec3.vue'
export { default as PropertyInput } from './PropertyInput.vue'
export { default as PropertyInputNumber } from './PropertyInputNumber.vue'

// 导出类型
export type { SelectOption } from './PropertySelect.vue'
