# 《超越界面：秩序与混沌》V2 · 第三方技术与版权
V2 原创的是展览的思想结构、手势编排、字模/几何/材质、显微光照、感知错觉、跨幕物质留印、声音和操作设计，不是下面的求解算法或引擎。全部静态运行资产随网页一并分发，没有第三方 CDN。

|作者 / 上游固定源|许可|实际留下什么、改了什么|
|---|---|---|
|[three.js authors，r180](https://github.com/mrdoob/three.js/tree/0af9729d0c143a86a1d725d6e2c3ad83301f3f34)，官方 examples 中 buffergeometry_custom_attributes_particles、physical_clearcoat、physical_transmission 与 webgl_camera|[MIT](licenses/three-MIT.txt)|Ⅰ 沿用 Points、BufferGeometry、自定义点尺寸/投影、点精灵采样；原创 ORDER 字模与折纸曲面，普通 alpha 取代 V1 加色。Ⅳ 采用相机透视矩阵的 WebGL 分支，原创 15 构件配准、表面题字及转动轨道。Ⅴ 保留 MeshPhysicalMaterial、FlakesTexture、真实透射和环境预滤；原创双变形场、形体、刻标与影棚。未分发示例模型、渲染照片、HDR 和字体。|
|[RoomEnvironment / Google model-viewer 上游 EnvironmentScene](https://github.com/google/model-viewer/blob/master/packages/model-viewer/src/three-components/EnvironmentScene.ts)，Copyright 2021 Google LLC|[Apache-2.0 上游全文](licenses/model-viewer-upstream-LICENSE.txt)，经 r180 MIT 模块使用|保留程序影棚并加遮光旗、软箱；不分发 model-viewer 运行时。|
|[Pavel Dobryakov · WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/tree/a2d292931f19d9b3b9f564e23e6c32729d2121c3)，2017|[MIT](licenses/PavelDoGreat-WebGL-Fluid-Simulation.MIT.txt)|Ⅱ 保留原顶点与 splat、curl、vorticity、divergence、压力衰减/迭代、梯度扣除和平流 GLSL 核；适配 GLSL300/共享上下文。V2 以真实速度场偏移本机生成的 CHAOS 字模，用浓度梯度作油墨高光；输入动量参与后幕种子形成。不使用商店界面或原 GUI。|
|[Dongcheng Cang · reaction-diffusion](https://github.com/cangdongcheng/reaction-diffusion/tree/5c9f284eb09600fe82436e449d8d2fad2414c71e)，2026|[MIT](licenses/cangdongcheng-reaction-diffusion.MIT.txt)|Ⅲ 直接保留 SIM_FRAG 的双组分、九点拉普拉斯、Gray–Scott 反应与笔刷；本作新增初始种子布局、宿主双缓冲、浓度浮雕、组织字样、色谱与手势映射。另两份候选仅作研究。|
|[Iwan Kelaiah · WebGL Fractal Explorer](https://github.com/ikelaiah/webgl-fractal-explorer/tree/7e4bbe79c7785ff36fd37a61ca0e68f8a70da3c5)，2026|[MIT](licenses/fractal-explorer-MIT.txt)|Ⅵ 保留 Julia 二次轨道迭代/陷阱核，改为逐尺度蚀刻、原作印像、频带/种子/塑形控制。不是原浏览器控制台、曼德博海报或预渲染宇宙。|
|[gl-transitions contributors](https://github.com/gl-transitions/gl-transitions/tree/22326e3d2099a0ccdbeeebd091d151182c2e7669)，Eke Péter：CrossWarp；pschroen：DirectionalWarp|[MIT](licenses/gl-transitions-MIT.txt)|保留两段原片元函数；输入不是示例 JPEG，而是当前实绘的出场与入场纹理。Ⅴ 另留长边最多768的离场帧，供Ⅵ取样。|

V1 的 r122 Verlet 布带已退出本版正式六幕；旧版原实现及其 MIT 许可完整保存在 V1 封存中。系统字体仅在用户设备上调用，不打包字体。全部数字形体、纹理、声音均可在浏览器本地生成，不含外部人物、照片、商标、音轨、模型或商业站资源。开发工具 esbuild (Evan Wallace / MIT)、Playwright、Chrome 与 FFmpeg 不作为网页运行依赖。参照来源仅作方法研究，不将浏览器可访问等同于素材授权。
