'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, Plus, Trash2, Clock, CheckCircle, XCircle, AlertTriangle, Lock } from 'lucide-react'
import { useIsGestor } from '@/hooks/use-role'

interface RegistroAuditoria {
  id: string
  userId: string
  userEmail: string
  acao: string
  acaoLabel: string
  recurso: string
  detalhes: Record<string, unknown> | null
  ip: string | null
  criadoEm: string
}

interface IpPermitido {
  id: string
  ip: string
  descricao: string | null
  criadoEm: string
}

interface AprovacaoPendente {
  id: string
  solicitanteId: string
  acao: string
  descricaoAcao: string
  status: string
  criadoEm: string
  expiradoEm: string
}

const CORES_ACAO: Record<string, string> = {
  exportar_csv: 'text-amber-600',
  deletar_dados_lgpd: 'text-red-600',
  deletar_todos_fornecedores: 'text-red-600',
  excluir_fornecedor: 'text-red-500',
  adicionar_ip: 'text-blue-600',
  remover_ip: 'text-orange-600',
  aprovar_acao: 'text-green-600',
  rejeitar_acao: 'text-red-600',
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function SegurancaPage() {
  const isGestor = useIsGestor()
  const [aba, setAba] = useState<'auditoria' | 'ips' | 'aprovacoes'>('auditoria')

  // Auditoria
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([])
  const [carregandoAudit, setCarregandoAudit] = useState(true)

  // IPs
  const [ips, setIps] = useState<IpPermitido[]>([])
  const [carregandoIps, setCarregandoIps] = useState(false)
  const [novoIp, setNovoIp] = useState('')
  const [descricaoIp, setDescricaoIp] = useState('')
  const [adicionandoIp, setAdicionandoIp] = useState(false)
  const [erroIp, setErroIp] = useState<string | null>(null)

  // Aprovações
  const [aprovacoes, setAprovacoes] = useState<AprovacaoPendente[]>([])
  const [carregandoAprov, setCarregandoAprov] = useState(false)
  const [resolvendo, setResolvendo] = useState<string | null>(null)

  const carregarAuditoria = useCallback(async () => {
    setCarregandoAudit(true)
    try {
      const res = await fetch('/api/auditoria?limite=200')
      if (res.ok) setRegistros(await res.json())
    } finally {
      setCarregandoAudit(false)
    }
  }, [])

  const carregarIps = useCallback(async () => {
    setCarregandoIps(true)
    try {
      const res = await fetch('/api/seguranca/ip')
      if (res.ok) setIps(await res.json())
    } finally {
      setCarregandoIps(false)
    }
  }, [])

  const carregarAprovacoes = useCallback(async () => {
    setCarregandoAprov(true)
    try {
      const res = await fetch('/api/seguranca/aprovacoes')
      if (res.ok) setAprovacoes(await res.json())
    } finally {
      setCarregandoAprov(false)
    }
  }, [])

  useEffect(() => {
    carregarAuditoria()
  }, [carregarAuditoria])

  useEffect(() => {
    if (aba === 'ips') carregarIps()
    if (aba === 'aprovacoes') carregarAprovacoes()
  }, [aba, carregarIps, carregarAprovacoes])

  async function adicionarIp() {
    setErroIp(null)
    setAdicionandoIp(true)
    try {
      const res = await fetch('/api/seguranca/ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: novoIp.trim(), descricao: descricaoIp.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) { setErroIp(json.error); return }
      setNovoIp('')
      setDescricaoIp('')
      await carregarIps()
    } finally {
      setAdicionandoIp(false)
    }
  }

  async function removerIp(id: string) {
    await fetch(`/api/seguranca/ip/${id}`, { method: 'DELETE' })
    await carregarIps()
  }

  async function resolverAprovacao(id: string, decisao: 'aprovado' | 'rejeitado') {
    setResolvendo(id)
    try {
      await fetch(`/api/seguranca/aprovacoes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao }),
      })
      await carregarAprovacoes()
    } finally {
      setResolvendo(null)
    }
  }

  if (!isGestor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Acesso restrito</h2>
        <p className="text-muted-foreground max-w-sm">
          As configurações de segurança são exclusivas de <strong>Gestores</strong>.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Segurança</h1>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Auditoria de ações, controle de IPs e aprovações duplas
          </p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-border">
        {([
          { id: 'auditoria', label: 'Auditoria de Ações' },
          { id: 'ips', label: 'IPs Permitidos' },
          { id: 'aprovacoes', label: 'Aprovações Pendentes' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setAba(tab.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              aba === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.id === 'aprovacoes' && aprovacoes.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                {aprovacoes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── AUDITORIA ── */}
      {aba === 'auditoria' && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 bg-muted/50 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground/80">Registro de ações</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">Últimas 200 operações de escrita na organização</p>
            </div>
            <button
              onClick={carregarAuditoria}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Atualizar
            </button>
          </div>

          {carregandoAudit ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : registros.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhuma ação registrada ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 border-b border-border/60">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground/70 uppercase tracking-wider text-[10px]">Data/Hora</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground/70 uppercase tracking-wider text-[10px]">Usuário</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground/70 uppercase tracking-wider text-[10px]">Ação</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground/70 uppercase tracking-wider text-[10px]">Detalhes</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground/70 uppercase tracking-wider text-[10px]">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {registros.map((r) => (
                    <tr key={r.id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-2.5 text-muted-foreground/70 whitespace-nowrap num">
                        {formatarData(r.criadoEm)}
                      </td>
                      <td className="px-4 py-2.5 text-foreground/80 max-w-[180px] truncate">
                        {r.userEmail}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`font-semibold ${CORES_ACAO[r.acao] ?? 'text-foreground'}`}>
                          {r.acaoLabel}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground/70 max-w-[200px]">
                        {r.detalhes ? (
                          <span className="font-mono text-[10px]">
                            {Object.entries(r.detalhes)
                              .slice(0, 2)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' · ')}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground/50 whitespace-nowrap">
                        {r.ip ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── IPs PERMITIDOS ── */}
      {aba === 'ips' && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Como funciona a restrição de IP
            </p>
            <p className="text-xs">
              Se você cadastrar ao menos 1 IP, apenas requisições originadas desses endereços poderão
              executar operações de escrita (importar, exportar, editar, excluir).
              Deixe a lista vazia para permitir acesso de qualquer IP.
            </p>
          </div>

          {/* Adicionar novo IP */}
          <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4">
            <p className="text-sm font-semibold text-foreground/80">Adicionar IP autorizado</p>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Ex: 200.100.50.10"
                value={novoIp}
                onChange={(e) => setNovoIp(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && adicionarIp()}
                className="border border-border rounded-lg px-3 py-2 text-sm font-mono bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
              />
              <input
                type="text"
                placeholder="Descrição (ex: Escritório SP)"
                value={descricaoIp}
                onChange={(e) => setDescricaoIp(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && adicionarIp()}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[160px]"
              />
              <button
                onClick={adicionarIp}
                disabled={adicionandoIp || !novoIp.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {adicionandoIp ? 'Adicionando...' : 'Adicionar'}
              </button>
            </div>
            {erroIp && (
              <p className="text-sm text-red-600">{erroIp}</p>
            )}
          </div>

          {/* Lista de IPs */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60 bg-muted/50">
              <p className="text-sm font-semibold text-foreground/80">
                {ips.length === 0
                  ? 'Nenhum IP cadastrado — acesso liberado de qualquer origem'
                  : `${ips.length} IP${ips.length > 1 ? 's' : ''} autorizado${ips.length > 1 ? 's' : ''}`}
              </p>
            </div>
            {carregandoIps ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : ips.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Adicione IPs acima para restringir o acesso.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {ips.map((ip) => (
                  <div key={ip.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-foreground num">{ip.ip}</span>
                      {ip.descricao && (
                        <span className="text-xs text-muted-foreground">{ip.descricao}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-muted-foreground/50">
                        {formatarData(ip.criadoEm)}
                      </span>
                      <button
                        onClick={() => removerIp(ip.id)}
                        className="p-1.5 text-muted-foreground/50 hover:text-red-500 transition-colors rounded"
                        title="Remover IP"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── APROVAÇÕES PENDENTES ── */}
      {aba === 'aprovacoes' && (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800/60 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <p className="font-semibold">Aprovação dupla para ações críticas</p>
            <p className="text-xs">
              Quando um Gestor solicita a exclusão definitiva de dados (LGPD), outro Gestor da organização
              deve aprovar a ação aqui. Se você for o único Gestor, a aprovação é automática.
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60 bg-muted/50 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground/80">
                {aprovacoes.length === 0 ? 'Nenhuma aprovação pendente' : `${aprovacoes.length} aguardando decisão`}
              </p>
              <button
                onClick={carregarAprovacoes}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Atualizar
              </button>
            </div>

            {carregandoAprov ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : aprovacoes.length === 0 ? (
              <div className="p-10 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma ação aguardando aprovação.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {aprovacoes.map((aprov) => (
                  <div key={aprov.id} className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground text-sm">{aprov.descricaoAcao}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Solicitado em {formatarData(aprov.criadoEm)}
                          </span>
                          <span>·</span>
                          <span>Expira em {formatarData(aprov.expiradoEm)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => resolverAprovacao(aprov.id, 'aprovado')}
                          disabled={!!resolvendo}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Aprovar
                        </button>
                        <button
                          onClick={() => resolverAprovacao(aprov.id, 'rejeitado')}
                          disabled={!!resolvendo}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Rejeitar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
