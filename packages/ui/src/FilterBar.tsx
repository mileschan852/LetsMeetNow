import { useState } from 'react'
import type { Lang, FilterConfig } from 'dating-core/types'

export interface FilterBarProps {
  lang: Lang
  filtersUnlocked: boolean
  configs: FilterConfig[]
  values: Record<string, string | string[]>
  onChange: (key: string, value: string | string[]) => void
  onReset: () => void
  onClose: () => void
}

export function FilterBar({ lang, filtersUnlocked, configs, values, onChange, onReset, onClose }: FilterBarProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  return (
    <div className="px-3 py-2 space-y-2 bg-[#0A0A0A]">
      <div className="flex items-center justify-between">
        <span className="text-[#8E8E93] text-xs">Filters</span>
        <div className="flex gap-2">
          <button onClick={onReset} className="text-[#FF6B35] text-xs">Reset</button>
          <button onClick={onClose} className="text-[#8E8E93] text-xs">Done</button>
        </div>
      </div>

      {configs.map(cfg => {
        const isLocked = !filtersUnlocked && cfg.key !== 'online'
        const val = values[cfg.key]

        return (
          <div key={cfg.key} className={`rounded-lg border ${isLocked ? 'border-[#8E8E93]/30 opacity-50' : 'border-[#2C2C2E]'} overflow-hidden`}>
            <button
              onClick={() => setExpanded(prev => {
                const next = new Set(prev)
                next.has(cfg.key) ? next.delete(cfg.key) : next.add(cfg.key)
                return next
              })}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-white"
            >
              <span>{cfg.label[lang] || cfg.label.en}</span>
              <span className="text-[#8E8E93]">{expanded.has(cfg.key) ? '▼' : '▶'}</span>
            </button>

            {expanded.has(cfg.key) && (
              <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                {isLocked && (
                  <div className="w-full text-center text-[#8E8E93] text-xs py-1">🔒 Unlock filters to use</div>
                )}
                {cfg.options.map(opt => {
                  const selected = cfg.multi
                    ? (val as string[] || []).includes(opt.value)
                    : val === opt.value

                  return (
                    <button
                      key={opt.value}
                      disabled={isLocked}
                      onClick={() => {
                        if (cfg.multi) {
                          const current = (val as string[] || []) as string[]
                          const next = selected
                            ? current.filter(v => v !== opt.value)
                            : [...current, opt.value]
                          onChange(cfg.key, next)
                        } else {
                          onChange(cfg.key, selected ? '' : opt.value)
                        }
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                        selected
                          ? 'bg-[#FF6B35] text-white'
                          : 'bg-[#2C2C2E] text-[#8E8E93]'
                      } ${isLocked ? 'cursor-not-allowed' : ''}`}
                    >
                      {opt.label[lang] || opt.label.en}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
