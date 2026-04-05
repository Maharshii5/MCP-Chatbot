'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Cpu, Database, Settings, Shield, X, Command } from 'lucide-react'

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

export default function CommandPalette({ isOpen, onClose, onSelectModel, onToggleSettings }: any) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const commands: CommandItem[] = [
    { id: 'sonnet-3-5', label: 'Engineer Mode: Claude 3.5 Sonnet', icon: <Cpu />, action: () => onSelectModel('anthropic/claude-3-5-sonnet'), category: 'Models' },
    { id: 'llama-3-3', label: 'Fast Mode: Llama 3.3 70B', icon: <Cpu />, action: () => onSelectModel('llama-3.3-70b-versatile'), category: 'Models' },
    { id: 'gpt-4o', label: 'Creative Mode: GPT-4o', icon: <Cpu />, action: () => onSelectModel('openai/gpt-4o'), category: 'Models' },
    { id: 'rag-mode', label: 'Toggle Knowledge Base (RAG)', icon: <Database />, action: () => {}, category: 'Tools' },
    { id: 'mcp-settings', label: 'Open MCP Controls', icon: <Shield />, action: () => onToggleSettings(true), category: 'System' },
    { id: 'app-settings', label: 'Display Settings', icon: <Settings />, action: () => {}, category: 'System' },
  ]

  const filteredCommands = commands.filter(c => 
    c.label.toLowerCase().includes(query.toLowerCase()) || 
    c.category.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!isOpen) return null

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="command-palette-container glass-container"
        onClick={e => e.stopPropagation()}
      >
        <div className="palette-search">
          <Search size={18} className="text-muted" />
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Type a command or search..." 
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd className="palette-kbd">ESC</kbd>
        </div>

        <div className="palette-results">
          {filteredCommands.length > 0 ? (
            Object.entries(
              filteredCommands.reduce((acc, cmd) => {
                if (!acc[cmd.category]) acc[cmd.category] = [];
                acc[cmd.category].push(cmd);
                return acc;
              }, {} as Record<string, CommandItem[]>)
            ).map(([category, items]) => (
              <div key={category} className="palette-group">
                <div className="group-label">{category}</div>
                {items.map(item => (
                  <button 
                    key={item.id} 
                    className="palette-item"
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                  >
                    <span className="item-icon">{item.icon}</span>
                    <span className="item-label">{item.label}</span>
                  </button>
                ))}
              </div>
            ))
          ) : (
            <div className="palette-empty">No results found</div>
          )}
        </div>

        <div className="palette-footer">
          <Command size={12} />
          <span>Workstation Terminal v9.4</span>
        </div>
      </motion.div>

      <style jsx>{`
        .command-palette-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(4px);
          z-index: 10000;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 15vh;
        }

        .command-palette-container {
          width: 100%;
          max-width: 600px;
          background: rgba(15, 15, 15, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.8);
          overflow: hidden;
        }

        .palette-search {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .palette-search input {
          flex: 1;
          background: transparent;
          border: none;
          color: #fff;
          font-size: 1rem;
          outline: none;
        }

        .palette-kbd {
          font-size: 10px;
          background: rgba(255,255,255,0.1);
          padding: 2px 6px;
          border-radius: 4px;
          color: #666;
        }

        .palette-results {
          max-height: 400px;
          overflow-y: auto;
          padding: 8px;
        }

        .palette-group {
          margin-bottom: 12px;
        }

        .group-label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          color: #444;
          margin: 8px 12px;
          letter-spacing: 1px;
        }

        .palette-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: #ccc;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }

        .palette-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          transform: translateX(4px);
        }

        .item-icon {
          opacity: 0.5;
          display: flex;
          align-items: center;
        }

        .item-icon :global(svg) {
          width: 16px;
          height: 16px;
        }

        .palette-empty {
          padding: 32px;
          text-align: center;
          color: #555;
          font-size: 0.9rem;
        }

        .palette-footer {
          padding: 10px 16px;
          background: rgba(0,0,0,0.2);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          color: #333;
        }
      `}</style>
    </div>
  )
}
