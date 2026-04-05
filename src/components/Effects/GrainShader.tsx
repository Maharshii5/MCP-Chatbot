'use client'

import React, { useEffect, useRef } from 'react'

/**
 * WebGL Grain Shader Component.
 * Provides a high-end, monochrome moving noise background for the workstation.
 */
export default function GrainShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl')
    if (!gl) return

    // --- Shader Sources ---
    const vsSource = `
      attribute vec4 aVertexPosition;
      void main() {
        gl_Position = aVertexPosition;
      }
    `

    const fsSource = `
      precision mediump float;
      uniform float uTime;
      uniform vec2 uResolution;

      float random(vec2 co) {
        return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / uResolution;
        
        // Generate grain
        float noise = random(uv + uTime * 0.01);
        
        // Subtle monochrome tint (near black)
        vec3 color = vec3(0.02, 0.02, 0.02);
        
        // Mix in grain (keep it very subtle)
        color += (noise - 0.5) * 0.015;
        
        gl_FragColor = vec4(color, 1.0);
      }
    `

    // --- Helper functions to compile/link ---
    const loadShader = (gl: WebGLRenderingContext, type: number, source: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      return shader
    }

    const shaderProgram = gl.createProgram()!
    gl.attachShader(shaderProgram, loadShader(gl, gl.VERTEX_SHADER, vsSource))
    gl.attachShader(shaderProgram, loadShader(gl, gl.FRAGMENT_SHADER, fsSource))
    gl.linkProgram(shaderProgram)

    const programInfo = {
      program: shaderProgram,
      attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
      },
      uniformLocations: {
        time: gl.getUniformLocation(shaderProgram, 'uTime'),
        resolution: gl.getUniformLocation(shaderProgram, 'uResolution'),
      },
    }

    // --- Define square geometry ---
    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    const positions = [
      -1.0,  1.0,
       1.0,  1.0,
      -1.0, -1.0,
       1.0, -1.0,
    ]
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW)

    let requestID: number

    const render = (time: number) => {
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0.0, 0.0, 0.0, 1.0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      gl.useProgram(programInfo.program)
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 2, gl.FLOAT, false, 0, 0)
      gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition)

      gl.uniform1f(programInfo.uniformLocations.time, time * 0.001)
      gl.uniform2f(programInfo.uniformLocations.resolution, canvas.width, canvas.height)

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      requestID = requestAnimationFrame(render)
    }

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener('resize', resize)
    resize()
    requestID = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(requestID)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -2,
        pointerEvents: 'none',
        opacity: 0.8
      }}
    />
  )
}
