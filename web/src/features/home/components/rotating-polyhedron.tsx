/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useRef, useState } from 'react'

import { cssColorToVec3 } from '@/lib/oklch'
import { cn } from '@/lib/utils'

type Point3D = [number, number, number]

type RotatingPolyhedronProps = {
  className?: string
  label: string
  statusLabel?: string
}

/**
 * Small stellated dodecahedron {5/2, 5}.
 *
 * The first stellation of the dodecahedron: 12 pentagram faces meeting five
 * around each vertex. Its 12 vertices are exactly the icosahedron's vertices,
 * and each face is the set of 5 coplanar icosahedron vertices, connected as a
 * pentagram (every second vertex around the ring). Coplanarity is what makes
 * this a true {5/2} face rather than a folded pyramid.
 *
 * Construction (verified): enumerate all 5-subsets of the 12 icosahedron
 * vertices, keep the 12 that are coplanar (each vertex appears in exactly 5),
 * and order each set as a pentagram by angle around its plane normal.
 */
const PHI = (1 + Math.sqrt(5)) / 2

// Icosahedron vertices on the unit sphere.
const ICO_VERTICES: Point3D[] = [
  [0, 1, PHI],
  [0, -1, PHI],
  [0, 1, -PHI],
  [0, -1, -PHI],
  [1, PHI, 0],
  [-1, PHI, 0],
  [1, -PHI, 0],
  [-1, -PHI, 0],
  [PHI, 0, 1],
  [PHI, 0, -1],
  [-PHI, 0, 1],
  [-PHI, 0, -1],
].map(([x, y, z]) => {
  const len = Math.hypot(x, y, z)
  return [x / len, y / len, z / len]
}) as Point3D[]

function areCoplanar(pts: Point3D[]): boolean {
  const [a, b, c] = pts
  const u: Point3D = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const v: Point3D = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const n: Point3D = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ]
  const nl = Math.hypot(n[0], n[1], n[2])
  if (nl < 1e-6) return false
  const nn = [n[0] / nl, n[1] / nl, n[2] / nl]
  const d = nn[0] * a[0] + nn[1] * a[1] + nn[2] * a[2]
  for (let i = 3; i < 5; i++) {
    const p = pts[i]
    if (Math.abs(nn[0] * p[0] + nn[1] * p[1] + nn[2] * p[2] - d) > 1e-4) {
      return false
    }
  }
  return true
}

// All 5-combinations of the 12 vertex indices.
const COMBOS: number[][] = []
;(function combos(start: number, cur: number[]) {
  if (cur.length === 5) {
    COMBOS.push([...cur])
    return
  }
  for (let i = start; i < 12; i++) {
    cur.push(i)
    combos(i + 1, cur)
    cur.pop()
  }
})(0, [])

// The 12 coplanar 5-subsets are the pentagram face vertex sets.
const COPLANAR_SETS: number[][] = COMBOS.filter((idx) =>
  areCoplanar(idx.map((i) => ICO_VERTICES[i]))
)

// Order each set as a pentagram: sort by angle around the face normal, then
// step every second vertex so consecutive face vertices are non-adjacent.
const STAR_FACES: number[][] = COPLANAR_SETS.map((set) => {
  const pts = set.map((i) => ICO_VERTICES[i])
  const [a, b, c] = pts
  const u: Point3D = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const v: Point3D = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const n: Point3D = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ]
  const nl = Math.hypot(n[0], n[1], n[2])
  const nn = [n[0] / nl, n[1] / nl, n[2] / nl]
  const centroid: Point3D = [0, 0, 0]
  for (const p of pts) {
    centroid[0] += p[0]
    centroid[1] += p[1]
    centroid[2] += p[2]
  }
  centroid[0] /= 5
  centroid[1] /= 5
  centroid[2] /= 5
  let t1: Point3D = [
    pts[0][0] - centroid[0],
    pts[0][1] - centroid[1],
    pts[0][2] - centroid[2],
  ]
  const t1l = Math.hypot(t1[0], t1[1], t1[2])
  t1 = [t1[0] / t1l, t1[1] / t1l, t1[2] / t1l]
  const t2: Point3D = [
    nn[1] * t1[2] - nn[2] * t1[1],
    nn[2] * t1[0] - nn[0] * t1[2],
    nn[0] * t1[1] - nn[1] * t1[0],
  ]
  const ordered = set
    .map((i) => {
      const p = ICO_VERTICES[i]
      const px =
        (p[0] - centroid[0]) * t1[0] +
        (p[1] - centroid[1]) * t1[1] +
        (p[2] - centroid[2]) * t1[2]
      const py =
        (p[0] - centroid[0]) * t2[0] +
        (p[1] - centroid[1]) * t2[1] +
        (p[2] - centroid[2]) * t2[2]
      return { i, angle: Math.atan2(py, px) }
    })
    .sort((a, b) => a.angle - b.angle)
    .map((r) => r.i)
  // Pentagram: every second vertex around the pentagon ring.
  const star: number[] = []
  for (let k = 0; k < 5; k++) star.push(ordered[(k * 2) % 5])
  return star
})

/**
 * Build the small stellated dodecahedron as flat-shaded triangles.
 *
 * Each pentagram face is 5 triangles from the face center to each star tip.
 * The center is the centroid of the 5 coplanar vertices, so the 5 triangles
 * tile the pentagram exactly. Flat normals make each facet catch light.
 */
function buildStellatedGeometry() {
  const positions: number[] = []
  const normals: number[] = []

  for (const face of STAR_FACES) {
    const pts = face.map((i) => ICO_VERTICES[i])
    const center: Point3D = [0, 0, 0]
    for (const p of pts) {
      center[0] += p[0]
      center[1] += p[1]
      center[2] += p[2]
    }
    center[0] /= 5
    center[1] /= 5
    center[2] /= 5
    for (let k = 0; k < 5; k++) {
      const v0 = pts[k]
      const v1 = pts[(k + 1) % 5]
      const e0: Point3D = [
        v0[0] - center[0],
        v0[1] - center[1],
        v0[2] - center[2],
      ]
      const e1: Point3D = [
        v1[0] - center[0],
        v1[1] - center[1],
        v1[2] - center[2],
      ]
      const n: Point3D = [
        e0[1] * e1[2] - e0[2] * e1[1],
        e0[2] * e1[0] - e0[0] * e1[2],
        e0[0] * e1[1] - e0[1] * e1[0],
      ]
      const len = Math.hypot(n[0], n[1], n[2]) || 1
      for (const v of [center, v0, v1]) {
        positions.push(...v)
        normals.push(n[0] / len, n[1] / len, n[2] / len)
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
  }
}

function flattenGeometry() {
  return buildStellatedGeometry()
}

const VERTEX_SHADER = `
  attribute vec3 a_position;
  attribute vec3 a_normal;
  uniform mat4 u_projection;
  uniform mat4 u_model;
  varying vec3 v_normal;
  varying vec3 v_position;
  void main() {
    vec4 position = u_model * vec4(a_position, 1.0);
    v_position = position.xyz;
    v_normal = mat3(u_model) * a_normal;
    gl_Position = u_projection * position;
  }
`

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform vec3 u_primary;
  uniform vec3 u_secondary;
  uniform vec3 u_accent;
  varying vec3 v_normal;
  varying vec3 v_position;
  void main() {
    vec3 normal = normalize(v_normal);
    vec3 viewDir = normalize(-v_position);
    // Key light upper-left drives the primary shading; a tinted fill from the
    // lower-right keeps recessed facets readable instead of falling to black.
    vec3 keyLight = normalize(vec3(-0.5, 0.75, 1.0));
    vec3 fillLight = normalize(vec3(0.6, -0.35, 0.5));
    vec3 rimLight = normalize(vec3(0.0, 0.4, -1.0));
    vec3 halfDir = normalize(keyLight + viewDir);

    float ndotl = max(dot(normal, keyLight), 0.0);
    float ndotf = max(dot(normal, fillLight), 0.0);
    // Steep diffuse ramp: adjacent facets (sharp dihedral angles) separate
    // cleanly instead of blending, so the star's edges read crisply.
    float keyDiff = smoothstep(0.0, 0.6, ndotl);
    // Lit faces read as primary; shadow faces swing toward the accent hue so
    // the two-tone split is visible even when the theme secondary is neutral.
    vec3 shadowHue = mix(u_secondary, u_accent, 0.55);
    vec3 baseColor = mix(shadowHue, u_primary, keyDiff);
    baseColor += u_accent * ndotf * 0.22;
    // Controlled specular: tight bright hotspot, no overblown wash.
    float ndoth = max(dot(normal, halfDir), 0.0);
    float spec = pow(ndoth, 96.0) * 0.9 + pow(ndoth, 24.0) * 0.25;
    vec3 specColor = mix(vec3(1.0), u_primary, 0.25);
    // Fresnel edge + rim carry the accent so silhouettes show the second hue.
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.0);
    float rim = pow(1.0 - max(dot(normal, rimLight), 0.0), 1.4);
    vec3 color = baseColor * 0.85 + specColor * spec + u_accent * fresnel * 0.45 + mix(u_accent, u_primary, 0.35) * rim * 0.3;
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(luma), color, 1.35);
    gl_FragColor = vec4(color, 1.0);
  }
`

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  if (!vertex || !fragment) return null
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null
}

function perspective(fov: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fov / 2)
  return new Float32Array([
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (far + near) / (near - far),
    -1,
    0,
    0,
    (2 * far * near) / (near - far),
    0,
  ])
}

function modelMatrix(rotationX: number, rotationY: number) {
  const cx = Math.cos(rotationX)
  const sx = Math.sin(rotationX)
  const cy = Math.cos(rotationY)
  const sy = Math.sin(rotationY)
  return new Float32Array([
    cy,
    sx * sy,
    -cx * sy,
    0,
    0,
    cx,
    sx,
    0,
    sy,
    -sx * cy,
    cx * cy,
    0,
    0,
    0,
    -4.2,
    1,
  ])
}

/** Resolve theme colors into WebGL float vectors from the active preset. */
function themeColors(scope: Element): {
  primary: [number, number, number]
  secondary: [number, number, number]
  accent: [number, number, number]
} {
  const primary = cssColorToVec3('--primary', [0.08, 0.45, 0.88], scope)
  const secondary = cssColorToVec3('--secondary', [0.38, 0.2, 0.76], scope)
  const [r, g, b] = primary
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1) || 1)
  const targetH = (h + 0.15) % 1
  const targetS = Math.max(s, 0.65)
  const targetL = Math.min(Math.max(l, 0.55), 0.65)
  const c = (1 - Math.abs(2 * targetL - 1)) * targetS
  const x = c * (1 - Math.abs(((targetH * 6) % 2) - 1))
  const m = targetL - c / 2
  let accent: [number, number, number] = [0.5, 0.5, 0.5]
  const sector = Math.floor(targetH * 6)
  if (sector === 0) accent = [c + m, x + m, m]
  else if (sector === 1) accent = [x + m, c + m, m]
  else if (sector === 2) accent = [m, c + m, x + m]
  else if (sector === 3) accent = [m, x + m, c + m]
  else if (sector === 4) accent = [x + m, m, c + m]
  else accent = [c + m, m, x + m]
  return { primary, secondary, accent }
}

function StaticPolyhedron() {
  return (
    <svg
      aria-hidden='true'
      className='text-primary/80 absolute inset-[16%] size-[68%]'
      viewBox='0 0 240 240'
      fill='none'
    >
      <defs>
        <linearGradient
          id='polyhedron-fallback'
          x1='32'
          y1='22'
          x2='204'
          y2='218'
          gradientUnits='userSpaceOnUse'
        >
          <stop stopColor='currentColor' stopOpacity='.9' />
          <stop offset='1' stopColor='currentColor' stopOpacity='.25' />
        </linearGradient>
      </defs>
      <path
        d='m120 18 88 102-88 102-88-102L120 18Z'
        stroke='url(#polyhedron-fallback)'
        strokeWidth='1.5'
      />
      <path
        d='m120 18 30 102-30 102m0-204-30 102 30 102m-88-102h176'
        stroke='currentColor'
        strokeOpacity='.45'
      />
      <path
        d='m120 18 88 102m-88 102 88-102m-88-102L32 120m88 102-88-102'
        stroke='currentColor'
        strokeOpacity='.25'
        strokeDasharray='3 8'
      />
      <circle cx='120' cy='120' r='5' fill='currentColor' />
    </svg>
  )
}

export function RotatingPolyhedron(props: RotatingPolyhedronProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [webglFailed, setWebglFailed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    if (!canvas || !stage) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const context = canvas.getContext('webgl', { antialias: true, alpha: true })
    if (!context) {
      setWebglFailed(true)
      return
    }
    const gl = context
    const program = createProgram(gl)
    if (!program) {
      setWebglFailed(true)
      return
    }
    const geometry = flattenGeometry()
    const positionBuffer = gl.createBuffer()
    const normalBuffer = gl.createBuffer()
    if (!positionBuffer || !normalBuffer) {
      setWebglFailed(true)
      return
    }
    gl.useProgram(program)
    gl.enable(gl.DEPTH_TEST)
    // The small stellated dodecahedron is a self-intersecting star: its faces
    // fold into the valleys where the surface normal points inward by
    // definition. Back-face culling would punch holes in those valleys, so
    // draw every triangle and let depth sorting resolve the overlap.
    gl.disable(gl.CULL_FACE)
    // Coplanar/penetrating faces z-fight; nudge each fragment so coincident
    // surfaces resolve deterministically instead of shimmering.
    gl.enable(gl.POLYGON_OFFSET_FILL)
    gl.polygonOffset(1, 1)

    const positionLocation = gl.getAttribLocation(program, 'a_position')
    const normalLocation = gl.getAttribLocation(program, 'a_normal')
    const projectionLocation = gl.getUniformLocation(program, 'u_projection')
    const modelLocation = gl.getUniformLocation(program, 'u_model')
    const primaryLocation = gl.getUniformLocation(program, 'u_primary')
    const secondaryLocation = gl.getUniformLocation(program, 'u_secondary')
    const accentLocation = gl.getUniformLocation(program, 'u_accent')
    let frame = 0
    let rotationX = -0.35
    let rotationY = 0
    let rotationYBase = 0
    // Pointer influence eases toward the cursor (magnetic tilt) instead of
    // snapping, so moving the mouse over the object gently tilts it and
    // returning it to rest falls back to the ambient precession.
    let targetOffsetX = 0
    let targetOffsetY = 0
    let tiltX = 0
    let tiltY = 0
    let pointerX = 0
    let pointerY = 0
    let lastTime = 0
    let canvasW = 0
    let canvasH = 0

    const resize = () => {
      const bounds = stage.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const nextW = Math.max(1, Math.floor(bounds.width * ratio))
      const nextH = Math.max(1, Math.floor(bounds.height * ratio))
      // Resizing the canvas clears the WebGL context state, so only touch it
      // when the backing store actually changes.
      if (nextW !== canvasW || nextH !== canvasH) {
        canvasW = nextW
        canvasH = nextH
        canvas.width = canvasW
        canvas.height = canvasH
        gl.viewport(0, 0, canvasW, canvasH)
      }
    }

    const draw = (time: number) => {
      const delta = lastTime ? Math.min(time - lastTime, 50) : 16
      lastTime = time
      const colors = themeColors(stage)
      if (!reducedMotion.matches) {
        // Slow precession: steady spin around Y with a gentle X wobble.
        rotationYBase += delta * 0.00022
        const wobble = -0.35 + Math.sin(time * 0.00012) * 0.18
        // Magnetic tilt: ease the pointer offsets toward the cursor and blend
        // them over the ambient spin, so hover feels physical rather than jumpy.
        tiltX += (targetOffsetX - tiltX) * 0.06
        tiltY += (targetOffsetY - tiltY) * 0.06
        rotationX = wobble + tiltY * 0.5
        rotationY = rotationYBase + tiltX * 0.6
      }
      resize()
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, geometry.positions, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(positionLocation)
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0)
      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, geometry.normals, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(normalLocation)
      gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0)
      gl.uniformMatrix4fv(
        projectionLocation,
        false,
        perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 100)
      )
      gl.uniformMatrix4fv(
        modelLocation,
        false,
        modelMatrix(rotationX, rotationY)
      )
      gl.uniform3f(
        primaryLocation,
        colors.primary[0],
        colors.primary[1],
        colors.primary[2]
      )
      gl.uniform3f(
        secondaryLocation,
        colors.secondary[0],
        colors.secondary[1],
        colors.secondary[2]
      )
      gl.uniform3f(
        accentLocation,
        colors.accent[0],
        colors.accent[1],
        colors.accent[2]
      )
      gl.drawArrays(gl.TRIANGLES, 0, geometry.positions.length / 3)
      if (!reducedMotion.matches) frame = requestAnimationFrame(draw)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = stage.getBoundingClientRect()
      pointerX = (event.clientX - bounds.left - bounds.width / 2) / bounds.width
      pointerY =
        (event.clientY - bounds.top - bounds.height / 2) / bounds.height
      targetOffsetX = pointerX
      targetOffsetY = pointerY
    }
    const handlePointerLeave = () => {
      targetOffsetX = 0
      targetOffsetY = 0
    }
    const handlePointerEnter = (event: PointerEvent) => {
      const bounds = stage.getBoundingClientRect()
      targetOffsetX =
        (event.clientX - bounds.left - bounds.width / 2) / bounds.width
      targetOffsetY =
        (event.clientY - bounds.top - bounds.height / 2) / bounds.height
    }
    const handleMotionChange = () => {
      cancelAnimationFrame(frame)
      lastTime = 0
      draw(0)
      if (!reducedMotion.matches) frame = requestAnimationFrame(draw)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    stage.addEventListener('pointermove', handlePointerMove)
    stage.addEventListener('pointerenter', handlePointerEnter)
    stage.addEventListener('pointerleave', handlePointerLeave)
    reducedMotion.addEventListener('change', handleMotionChange)
    resize()
    draw(0)
    if (!reducedMotion.matches) frame = requestAnimationFrame(draw)

    // Repaint when the landing tone, theme preset, dark mode, or font changes.
    const themeObserver = new MutationObserver(() => {
      lastTime = 0
      draw(0)
      if (!reducedMotion.matches) frame = requestAnimationFrame(draw)
    })
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-theme-preset', 'data-theme-font'],
    })
    // The landing wrapper carries `data-landing-tone`; watch it so switching
    // tone re-tints the polyhedron even though the body preset is untouched.
    themeObserver.observe(stage, {
      attributes: true,
      attributeFilter: ['data-landing-tone'],
    })
    const handleColorSchemeChange = () => {
      lastTime = 0
      draw(0)
      if (!reducedMotion.matches) frame = requestAnimationFrame(draw)
    }
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')
    colorScheme.addEventListener('change', handleColorSchemeChange)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      themeObserver.disconnect()
      colorScheme.removeEventListener('change', handleColorSchemeChange)
      stage.removeEventListener('pointermove', handlePointerMove)
      stage.removeEventListener('pointerenter', handlePointerEnter)
      stage.removeEventListener('pointerleave', handlePointerLeave)
      reducedMotion.removeEventListener('change', handleMotionChange)
      gl.deleteBuffer(positionBuffer)
      gl.deleteBuffer(normalBuffer)
      gl.deleteProgram(program)
    }
  }, [])

  return (
    <div
      ref={stageRef}
      role='img'
      aria-label={props.label}
      className={cn(
        'group relative isolate flex aspect-square w-full cursor-grab items-center justify-center overflow-hidden active:cursor-grabbing',
        props.className
      )}
    >
      {/* Frame around the loop: hairline border + soft corner inset. */}
      <div
        aria-hidden='true'
        className='border-border/50 pointer-events-none absolute inset-[8%] rounded-[1.5rem] border'
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-[8%] rounded-[1.5rem] shadow-[inset_0_0_60px_-30px_var(--primary)]'
      />
      {/* Four radiating guide lines + agent labels around the loop. */}
      <div aria-hidden='true' className='pointer-events-none absolute inset-0'>
        {/* Top */}
        <span className='bg-primary/30 absolute top-0 left-1/2 h-1/4 w-px -translate-x-1/2 [background:linear-gradient(var(--primary),transparent)]' />
        <span className='border-primary/40 bg-background/80 text-primary absolute top-2 left-1/2 -translate-x-1/2 rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.15em] uppercase backdrop-blur-sm'>
          Claude
        </span>
        {/* Bottom */}
        <span className='bg-primary/30 absolute bottom-0 left-1/2 h-1/4 w-px -translate-x-1/2 [background:linear-gradient(transparent,var(--primary))]' />
        <span className='border-primary/40 bg-background/80 text-primary absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.15em] uppercase backdrop-blur-sm'>
          Codex
        </span>
        {/* Left */}
        <span className='bg-primary/30 absolute top-1/2 left-0 h-px w-1/4 -translate-y-1/2 [background:linear-gradient(90deg,var(--primary),transparent)]' />
        <span className='border-primary/40 bg-background/80 text-primary absolute top-1/2 left-2 -translate-y-1/2 rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.15em] uppercase backdrop-blur-sm'>
          Gemini
        </span>
        {/* Right */}
        <span className='bg-primary/30 absolute top-1/2 right-0 h-px w-1/4 -translate-y-1/2 [background:linear-gradient(90deg,transparent,var(--primary))]' />
        <span className='border-primary/40 bg-background/80 text-primary absolute top-1/2 right-2 -translate-y-1/2 rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.15em] uppercase backdrop-blur-sm'>
          Grok
        </span>
      </div>
      <canvas
        ref={canvasRef}
        aria-hidden='true'
        className={cn(
          'absolute inset-0 h-full w-full',
          webglFailed && 'hidden'
        )}
      />
      {webglFailed && <StaticPolyhedron />}
      {/* Glass highlight sweep for a refined, non-plastic finish. */}
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 bg-[linear-gradient(150deg,color-mix(in_oklch,var(--background)_55%,transparent)_0%,transparent_38%,color-mix(in_oklch,var(--primary)_10%,transparent)_100%)] opacity-60 mix-blend-soft-light'
      />
      {props.statusLabel ? (
        <div className='border-border/60 bg-background/70 text-muted-foreground pointer-events-none absolute top-[6%] left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] uppercase shadow-sm backdrop-blur-md'>
          <span className='size-1.5 rounded-full bg-emerald-500' />
          {props.statusLabel}
        </div>
      ) : null}
    </div>
  )
}
