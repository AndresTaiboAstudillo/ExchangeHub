'use client';

import { useState } from 'react';
import Badge from '../Badge';

export default function PostCard({ post, onToast }) {
  const [showReplies, setShowReplies] = useState(false);
  const [reply, setReply] = useState('');

  return (
    <div className="bg-white rounded-lg p-5 shadow-card mb-3.5 border-[1.5px] border-transparent hover:border-forest-lt transition-colors cursor-pointer">
      <div className="flex justify-between items-start mb-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ background: post.avatarColor }}
          >
            {post.author[0]}
          </div>
          <div>
            <div className="text-sm font-semibold">
              {post.author} <span className="text-xs font-normal text-muted">· {post.country}</span>
            </div>
            <div className="text-xs text-muted">{post.date}</div>
          </div>
        </div>
        <Badge text={post.badge.text} color={post.badge.color} />
      </div>

      <div className="text-[15px] font-bold mb-1.5">{post.title}</div>
      <div className="text-[13px] text-ink-mid leading-relaxed">{post.body}</div>

      <div className="flex items-center gap-3.5 mt-3 pt-3 border-t border-border">
        <button className="flex items-center gap-1 text-[13px] text-muted hover:text-forest-mid transition-colors">
          💬 {post.repliesCount} respuestas
        </button>
        <button className="flex items-center gap-1 text-[13px] text-muted hover:text-forest-mid transition-colors">
          👍 {post.likes}
        </button>
        <button
          onClick={() => setShowReplies((s) => !s)}
          className="flex items-center gap-1 text-[13px] text-muted hover:text-forest-mid transition-colors"
        >
          {showReplies ? 'Ocultar ▴' : 'Ver respuestas ▾'}
        </button>
      </div>

      {showReplies && (
        <div className="bg-surface rounded-lg p-3.5 mt-3 border border-border">
          {post.replies.map((r, i) => (
            <div key={i} className="py-2.5 border-b border-border last:border-b-0">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                  style={{ background: r.color }}
                >
                  {r.autor[0]}
                </div>
                <strong className="text-[13px]">{r.autor}</strong>
                <span className="text-xs text-muted">{r.pais}</span>
              </div>
              <p className="text-[13px] text-ink-mid">{r.texto}</p>
            </div>
          ))}
          <div className="flex gap-2 mt-2.5">
            <input
              type="text"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Escribe una respuesta…"
              className="flex-1 px-3 py-2 border-[1.5px] border-border rounded-lg text-sm"
            />
            <button
              onClick={() => {
                setReply('');
                onToast('Respuesta publicada');
              }}
              className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold bg-forest-mid text-white hover:bg-forest-lt transition-colors"
            >
              Responder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
