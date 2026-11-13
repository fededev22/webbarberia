"use client"

import { Float } from "@react-three/drei"
import { Canvas, useFrame } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import * as THREE from "three"

function stripeTexture() {
  const canvas = document.createElement("canvas")
  canvas.width = 128
  canvas.height = 512
  const g = canvas.getContext("2d")
  if (!g) return new THREE.Texture()
  g.fillStyle = "#171410"
  g.fillRect(0, 0, 128, 512)
  for (let i = -512; i < 640; i += 56) {
    g.fillStyle = i % 112 === 0 ? "#e0b15a" : "#c4784a"
    g.beginPath()
    g.moveTo(0, i)
    g.lineTo(128, i + 90)
    g.lineTo(128, i + 118)
    g.lineTo(0, i + 28)
    g.fill()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function Scene({ pointer }: { pointer: React.RefObject<{ x: number; y: number }> }) {
  const group = useRef<THREE.Group>(null)
  const pole = useRef<THREE.Mesh>(null)
  const scissors = useRef<THREE.Group>(null)
  const tex = useMemo(() => stripeTexture(), [])
  useFrame((_, delta) => {
    const targetY = (pointer.current?.x ?? 0) * 0.45
    const targetX = (pointer.current?.y ?? 0) * 0.18
    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetY, 3, delta)
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, targetX, 3, delta)
      const scroll = Math.min(window.scrollY / 700, 1)
      group.current.position.y = THREE.MathUtils.damp(group.current.position.y, -scroll * 0.45, 3, delta)
    }
    if (pole.current) pole.current.rotation.y += delta * 0.8
    if (scissors.current) scissors.current.rotation.z = Math.sin(performance.now() / 700) * 0.25
  })
  return (
    <group ref={group}>
      <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.35}>
        <mesh ref={pole} position={[0.35, 0.05, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 2.15, 48]} />
          <meshStandardMaterial map={tex} roughness={0.42} metalness={0.2} />
        </mesh>
        <mesh position={[0.35, 1.22, 0]}>
          <sphereGeometry args={[0.34, 32, 32]} />
          <meshStandardMaterial color="#e0b15a" metalness={0.6} roughness={0.25} />
        </mesh>
        <mesh position={[0.35, -1.12, 0]}>
          <cylinderGeometry args={[0.4, 0.46, 0.16, 32]} />
          <meshStandardMaterial color="#2a241c" metalness={0.4} roughness={0.4} />
        </mesh>
      </Float>
      <group ref={scissors} position={[-0.85, -0.15, 0.2]} rotation={[0.4, 0.5, 0.2]}>
        <mesh position={[0, 0.35, 0]} rotation={[0, 0, 0.5]}>
          <boxGeometry args={[0.12, 1.15, 0.04]} />
          <meshStandardMaterial color="#d7d1c7" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[0.15, 0.35, 0]} rotation={[0, 0, -0.5]}>
          <boxGeometry args={[0.12, 1.15, 0.04]} />
          <meshStandardMaterial color="#c4784a" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.1, 24, 24]} />
          <meshStandardMaterial color="#ff4d2e" />
        </mesh>
      </group>
    </group>
  )
}

export function HeroCanvas({ pointer }: { pointer: React.RefObject<{ x: number; y: number }> }) {
  return (
    <Canvas camera={{ position: [0, 0.15, 4.6], fov: 32 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }} aria-label="Poste de barbero">
      <ambientLight intensity={0.55} />
      <directionalLight position={[2.5, 3, 2]} intensity={2.4} color="#ffe1b0" />
      <pointLight position={[-2, 0.4, 2]} intensity={10} color="#ff4d2e" />
      <Scene pointer={pointer} />
    </Canvas>
  )
}
