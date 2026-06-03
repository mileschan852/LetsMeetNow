export function FlyingMessagesOverlay({ messages, onDone }: { messages: {id: number; text: string; top: string}[]; onDone: (id: number) => void }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-[70] overflow-hidden">
      {messages.map((m) => (
        <div
          key={m.id}
          className="absolute text-white text-sm font-bold px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm whitespace-nowrap animate-flyMessage"
          style={{ top: m.top, left: '-100%' }}
          onAnimationEnd={() => onDone(m.id)}
        >
          {m.text}
        </div>
      ))}
    </div>
  )
}
