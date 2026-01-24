// types/material.ts

import type { MaterialSideType, TextureFilterType, TextureWrappingType, MaterialBlendingType, DepthFuncType } from "./material-types.ts";

/**
 * 材质数据联合类型，支持所有基础材质类型
 */
export type MaterialData = 
  | MeshBasicMaterialData
  | MeshLambertMaterialData
  | MeshPhongMaterialData
  | MeshStandardMaterialData
  | MeshPhysicalMaterialData
  | MeshToonMaterialData
  | MeshMatcapMaterialData
  | LineBasicMaterialData
  | LineDashedMaterialData
  | PointsMaterialData
  | SpriteMaterialData
  | ShadowMaterialData;

/**
 * 材质基础接口 - 所有材质共有的属性
 */
interface BaseMaterialData {
  /** 
   * 材质类型标识符
   * @required
   */
  type: string;
  
  /** 
   * 材质名称（可选，用于识别）
   */
  name?: string;
  
  /** 
   * 材质颜色（十六进制或CSS颜色字符串）
   * @default "#ffffff"
   * @example "#ff0000", "rgb(255,0,0)", "red"
   */
  color?: string;
  
  /** 
   * 材质透明度
   * @default 1
   * @minimum 0
   * @maximum 1
   * @description 0为完全透明，1为完全不透明
   */
  opacity?: number;
  
  /** 
   * 是否透明
   * @default false
   * @description 当opacity小于1时，需要设置为true才能正确显示透明效果
   */
  transparent?: boolean;
  
  /** 
   * 是否启用深度测试
   * @default true
   * @description 控制物体之间的遮挡关系
   */
  depthTest?: boolean;
  
  /** 
   * 是否启用深度写入
   * @default true
   * @description 控制是否写入深度缓冲区
   */
  depthWrite?: boolean;
  
  /** 
   * 渲染顺序
   * @default 0
   * @description 数值越大越晚渲染（在顶层）
   */
  renderOrder?: number;
  
  /** 
   * 材质渲染面
   * @default 'front'
   */
  side?: MaterialSideType;
  
  /** 
   * 是否显示线框
   * @default false
   */
  wireframe?: boolean;
  
  /** 
   * 线框宽度（像素）
   * @default 1
   * @minimum 0.1
   * @note 在某些平台上可能受限于最大线宽
   */
  wireframeLinewidth?: number;
  
  /** 
   * 纹理包装模式（U方向）
   * @default 'repeat'
   */
  wrapS?: TextureWrappingType;
  
  /** 
   * 纹理包装模式（V方向）
   * @description 未设置时使用wrapS的值
   */
  wrapT?: TextureWrappingType;

  /**
   * 纹理重复次数（U方向）
   * @default 1
   */
  repeatX?: number;

  /**
   * 纹理重复次数（V方向）
   * @default 1
   */
  repeatY?: number;

  /**
   * 纹理偏移（U方向）
   * @default 0
   */
  offsetX?: number;

  /**
   * 纹理偏移（V方向）
   * @default 0
   */
  offsetY?: number;
  
  /** 
   * 纹理放大过滤
   * @default 'linear'
   */
  magFilter?: TextureFilterType;
  
  /** 
   * 纹理缩小过滤
   * @default 'linearMipmapLinear'
   */
  minFilter?: TextureFilterType;

  /**
   * Material blending mode.
   */
  blending?: MaterialBlendingType;

  /**
   * Depth function.
   */
  depthFunc?: DepthFuncType;

  /**
   * Premultiplied alpha.
   */
  premultipliedAlpha?: boolean;

  /**
   * Dithering.
   */
  dithering?: boolean;

  /**
   * Polygon offset.
   */
  polygonOffset?: boolean;

  /**
   * Polygon offset factor.
   */
  polygonOffsetFactor?: number;

  /**
   * Polygon offset units.
   */
  polygonOffsetUnits?: number;

  /**
   * Alpha test switch (UI uses boolean).
   * @default false
   */
  alphaTest?: boolean;

  /**
   * 贴图文件名映射（用于UI显示与持久化）
   */
  textureNames?: Record<string, string>;
}

// ==================== 第一层：贴图支持 ====================

/**
 * 支持基础贴图的材质基类
 */
interface MapMaterialData extends BaseMaterialData {
  /** 
   * 漫反射贴图ID
   * @description 引用纹理资源管理器的纹理ID
   */
  map?: string;
  
  /** 
   * Alpha贴图ID
   * @description 用于控制透明度的灰度贴图
   */
  alphaMap?: string;
  
  /** 
   * 环境贴图ID
   * @description 用于反射/折射的环境贴图
   */
  envMap?: string | string[];
  
  /**
   * 环境贴图类型
   * @default "equirect"
   */
  envMapType?: 'equirect' | 'hdr' | 'cube';
  
  /** 
   * 环境贴图对材质的影响程度
   * @default 1
   * @minimum 0
   */
  envMapIntensity?: number;

  /**
   * Light map.
   */
  lightMap?: string;

  /**
   * Light map intensity.
   */
  lightMapIntensity?: number;

  /**
   * Bump map.
   */
  bumpMap?: string;

  /**
   * Bump scale.
   */
  bumpScale?: number;
}

// ==================== 第二层：法线/位移贴图支持 ====================

/**
 * 支持法线/位移贴图的材质基类
 */
interface NormalDisplacementMaterialData extends MapMaterialData {
  /** 
   * 法线贴图ID
   * @description 用于模拟表面细节
   */
  normalMap?: string;
  
  /** 
   * 法线贴图强度
   * @default 1
   * @minimum 0
   * @maximum 10
   */
  normalScale?: number;
  
  /** 
   * 位移贴图ID
   * @description 用于顶点位移
   */
  displacementMap?: string;
  
  /** 
   * 位移强度
   * @default 1
   */
  displacementScale?: number;
  
  /** 
   * 位移偏移
   * @default 0
   */
  displacementBias?: number;
}

// ==================== 第三层：自发光支持 ====================

/**
 * 支持自发光的材质基类
 */
interface EmissiveMaterialData extends NormalDisplacementMaterialData {
  /** 
   * 自发光颜色
   * @default "#000000"
   */
  emissive?: string;
  
  /** 
   * 自发光强度
   * @default 1
   * @minimum 0
   */
  emissiveIntensity?: number;
  
  /** 
   * 自发光贴图ID
   */
  emissiveMap?: string;
}

// ==================== 第四层：环境光遮蔽支持 ====================

/**
 * 支持环境光遮蔽的材质基类
 */
interface AOMaterialData extends EmissiveMaterialData {
  /** 
   * 环境光遮蔽贴图ID
   */
  aoMap?: string;
  
  /** 
   * AO贴图强度
   * @default 1
   */
  aoMapIntensity?: number;
}

// ==================== 网格材质类 ====================

/**
 * 基础网格材质参数（无光照）
 */
export interface MeshBasicMaterialData extends MapMaterialData {
  type: 'basic';
  // 特有属性：无（继承MapMaterialData的所有属性）
}

/**
 * Lambert网格材质参数（漫反射光照）
 */
export interface MeshLambertMaterialData extends EmissiveMaterialData {
  type: 'lambert';
  // 特有属性：无（继承EmissiveMaterialData的所有属性）
}

/**
 * Phong网格材质参数（镜面高光）
 */
export interface MeshPhongMaterialData extends EmissiveMaterialData {
  type: 'phong';
  
  /** 
   * 镜面高光颜色
   * @default "#111111"
   */
  specular?: string;
  
  /** 
   * 高光强度（光泽度）
   * @default 30
   * @minimum 0
   * @maximum 1000
   */
  shininess?: number;
  
  /** 
   * 镜面贴图ID
   */
  specularMap?: string;
}

/**
 * 标准PBR材质参数（物理渲染）
 */
export interface MeshStandardMaterialData extends AOMaterialData {
  type: 'standard';
  
  /** 
   * 粗糙度
   * @default 1
   * @minimum 0
   * @maximum 1
   * @description 0为完全光滑（镜面），1为完全粗糙（漫反射）
   */
  roughness?: number;
  
  /** 
   * 金属度
   * @default 0
   * @minimum 0
   * @maximum 1
   * @description 0为非金属（塑料、陶瓷），1为金属（金、银、铜）
   */
  metalness?: number;
  
  /** 
   * 是否启用alpha测试
   * @default false
   * @description 启用后会根据alpha值完全丢弃像素
   */
  alphaTest?: boolean;
  
  /** 
   * 粗糙度贴图ID
   */
  roughnessMap?: string;
  
  /** 
   * 金属度贴图ID
   */
  metalnessMap?: string;

  /**
   * ARM打包贴图ID（AO/Roughness/Metalness）
   * @description 将AO、粗糙度、金属度打包到RGB三个通道的贴图
   * R通道=AO, G通道=Roughness, B通道=Metalness
   */
  armMap?: string;
}

/**
 * 物理PBR材质参数（扩展标准PBR）
 */
export interface MeshPhysicalMaterialData extends Omit<MeshStandardMaterialData, 'type'> {
  type: 'physical';
  
  /** 
   * 清漆层强度
   * @default 0
   * @minimum 0
   * @maximum 1
   * @description 模拟涂层效果（如汽车漆）
   */
  clearcoat?: number;
  
  /** 
   * 清漆层粗糙度
   * @default 0
   * @minimum 0
   * @maximum 1
   */
  clearcoatRoughness?: number;
  
  /** 
   * 折射率
   * @default 1.5
   * @minimum 1
   * @maximum 2.333
   * @description 控制材质的折射程度
   */
  ior?: number;
  
  /** 
   * 透射强度
   * @default 0
   * @minimum 0
   * @maximum 1
   * @description 控制光线穿透程度（类似磨砂玻璃）
   */
  transmission?: number;
  
  /** 
   * 透射贴图ID
   */
  transmissionMap?: string;
  
  /** 
   * 厚度贴图ID
   * @description 用于控制透射物体的厚度变化
   */
  thicknessMap?: string;
  
  /** 
   * 基础厚度
   * @default 0.01
   * @minimum 0
   */
  thickness?: number;
  
  /** 
   * 各向异性强度
   * @default 0
   * @minimum 0
   * @maximum 1
   * @description 模拟拉丝金属等各向异性表面
   */
  anisotropy?: number;
  
  /** 
   * 各向异性旋转（弧度）
   * @default 0
   * @unit 弧度
   */
  anisotropyRotation?: number;
  
  /** 
   * 各向异性贴图ID
   */
  anisotropyMap?: string;
  
  /** 
   * 清漆层法线贴图ID
   */
  clearcoatNormalMap?: string;
  
  /** 
   * 清漆层法线贴图强度
   * @default 1
   */
  clearcoatNormalScale?: number;

  clearcoatMap?: string;
  clearcoatRoughnessMap?: string;
  sheen?: number;
  sheenColor?: string;
  sheenRoughness?: number;
  sheenColorMap?: string;
  sheenRoughnessMap?: string;
  iridescence?: number;
  iridescenceIOR?: number;
  iridescenceThicknessRange?: [number, number];
  iridescenceMap?: string;
  iridescenceThicknessMap?: string;
  specularIntensity?: number;
  specularColor?: string;
  specularIntensityMap?: string;
  specularColorMap?: string;
  attenuationColor?: string;
  attenuationDistance?: number;
}

/**
 * 卡通材质参数
 */
export interface MeshToonMaterialData extends EmissiveMaterialData {
  type: 'toon';
  
  /** 
   * 渐变贴图ID
   * @description 控制卡通着色的渐变效果
   */
  gradientMap?: string;
}

/**
 * MatCap材质参数
 */
export interface MeshMatcapMaterialData extends BaseMaterialData {
  type: 'matcap';
  
  /** 
   * MatCap贴图ID
   * @description 包含光照信息的球面环境贴图
   */
  matcap?: string;
}

// ==================== 线条材质类 ====================

/**
 * 基础线条材质参数
 */
export interface LineBasicMaterialData extends BaseMaterialData {
  type: 'lineBasic';
  
  /** 
   * 线条宽度（像素）
   * @default 1
   * @minimum 0.1
   * @note 在某些平台上可能受限于最大线宽
   */
  linewidth?: number;
  
  /** 
   * 线段连接样式
   * @default 'round'
   */
  linecap?: 'butt' | 'round' | 'square';
  
  /** 
   * 线段交点样式
   * @default 'round'
   */
  linejoin?: 'round' | 'bevel' | 'miter';
}

/**
 * 虚线线条材质参数
 */
export interface LineDashedMaterialData extends Omit<LineBasicMaterialData, 'type'> {
  type: 'lineDashed';
  
  /** 
   * 虚线尺寸
   * @default 3
   * @minimum 0.1
   */
  dashSize?: number;
  
  /** 
   * 间隔尺寸
   * @default 1
   * @minimum 0.1
   */
  gapSize?: number;
  
  /** 
   * 虚线比例
   * @default 1
   */
  scale?: number;
}

// ==================== 其他材质类 ====================

/**
 * 点精灵材质参数
 */
export interface PointsMaterialData extends BaseMaterialData {
  type: 'points';

  map?: string;
  alphaMap?: string;
  
  /** 
   * 点大小
   * @default 1
   * @minimum 0
   */
  size?: number;
  
  /** 
   * 点大小是否随相机距离变化
   * @default true
   */
  sizeAttenuation?: boolean;
}

/**
 * 精灵材质参数
 */
export interface SpriteMaterialData extends MapMaterialData {
  type: 'sprite';
  sizeAttenuation?: boolean;
}

export interface ShadowMaterialData extends BaseMaterialData {
  type: 'shadow';
  // 特有属性：无（继承BaseMaterialData的所有属性）
}
