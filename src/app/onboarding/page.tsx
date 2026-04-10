'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { formatarCnpj, normalizarCnpj } from '@/lib/utils'
import { Scale } from 'lucide-react'

const schemaEtapa1 = z.object({
  cnpj: z.string().min(14, 'CNPJ inválido'),
  razaoSocial: z.string().min(3, 'Razão social obrigatória'),
  regime: z.enum([
    'simples_nacional', 'mei', 'lucro_presumido', 'lucro_real',
    'nanoempreendedor', 'isento', 'nao_identificado',
  ]),
})

const schemaEtapa2 = z.object({
  setor: z.enum([
    'industria', 'comercio_atacado', 'comercio_varejo', 'servicos',
    'servicos_saude', 'servicos_educacao', 'servicos_financeiros',
    'agronegocio', 'construcao_civil', 'transporte', 'tecnologia', 'misto',
  ]),
  uf: z.string().length(2, 'UF inválida'),
  municipio: z.string().min(2, 'Município obrigatório'),
  faturamentoAnual: z.number().positive('Faturamento deve ser positivo').optional(),
  aliquotaIcmsAtual: z.number().min(0).max(100).optional(),
  aliquotaIssAtual: z.number().min(0).max(100).optional(),
})

type FormEtapa1 = z.infer<typeof schemaEtapa1>
type FormEtapa2 = z.infer<typeof schemaEtapa2>

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

const inputCls = 'w-full border border-border rounded-xl px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow'
const labelCls = 'block text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1.5'

export default function OnboardingPage() {
  const router = useRouter()
  const { setActive } = useClerk()
  const { isLoaded, isSignedIn } = useUser()
  const [etapa, setEtapa] = useState(1)
  const [dadosEtapa1, setDadosEtapa1] = useState<FormEtapa1 | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const form1 = useForm<FormEtapa1>({ resolver: zodResolver(schemaEtapa1) })
  const form2 = useForm<FormEtapa2>({ resolver: zodResolver(schemaEtapa2) })

  const handleEtapa1 = (data: FormEtapa1) => {
    const cnpjLimpo = normalizarCnpj(data.cnpj.replace(/\D/g, ''))
    if (!cnpjLimpo) {
      form1.setError('cnpj', { message: 'CNPJ inválido' })
      return
    }
    setDadosEtapa1({ ...data, cnpj: cnpjLimpo })
    setEtapa(2)
  }

  const handleEtapa2 = async (data: FormEtapa2) => {
    if (!dadosEtapa1) return
    setEnviando(true)
    setErro(null)
    try {
      const res = await fetch('/api/empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...dadosEtapa1, ...data }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Erro ao criar empresa')
      }
      const json = await res.json()
      // Se uma nova organização foi criada, ativa-a na sessão antes de navegar
      if (json.orgId) {
        await setActive({ organization: json.orgId })
      }
      router.push('/dashboard')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setEnviando(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (!isSignedIn) {
    router.push('/sign-in')
    return null
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-tight">Reforma Tributária</p>
            <p className="text-xs text-muted-foreground/70 leading-tight">Simulador 2026–2033</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          {/* Progress */}
          <div className="mb-7">
            <div className="flex gap-1.5 mb-5">
              {[1, 2].map((n) => (
                <div
                  key={n}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    n <= etapa ? 'bg-blue-600' : 'bg-border'
                  }`}
                />
              ))}
            </div>
            <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-1">
              Etapa {etapa} de 2
            </p>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              {etapa === 1 ? 'Dados da empresa' : 'Perfil tributário'}
            </h1>
            <p className="text-muted-foreground/70 text-sm mt-1">
              {etapa === 1
                ? 'Informe os dados básicos da sua empresa'
                : 'Configure o perfil para cálculos precisos'}
            </p>
          </div>

          {/* Etapa 1 */}
          {etapa === 1 && (
            <form onSubmit={form1.handleSubmit(handleEtapa1)} className="space-y-4">
              <div>
                <label className={labelCls}>CNPJ</label>
                <input
                  {...form1.register('cnpj')}
                  placeholder="00.000.000/0000-00"
                  onChange={(e) => {
                    const limpo = e.target.value.replace(/\D/g, '')
                    form1.setValue('cnpj', formatarCnpj(limpo))
                  }}
                  className={`${inputCls} font-mono`}
                />
                {form1.formState.errors.cnpj && (
                  <p className="text-red-500 text-xs mt-1">{form1.formState.errors.cnpj.message}</p>
                )}
              </div>

              <div>
                <label className={labelCls}>Razão Social</label>
                <input
                  {...form1.register('razaoSocial')}
                  placeholder="Nome da sua empresa"
                  className={inputCls}
                />
                {form1.formState.errors.razaoSocial && (
                  <p className="text-red-500 text-xs mt-1">{form1.formState.errors.razaoSocial.message}</p>
                )}
              </div>

              <div>
                <label className={labelCls}>Regime Tributário</label>
                <select {...form1.register('regime')} className={inputCls}>
                  <option value="">Selecione o regime</option>
                  <option value="simples_nacional">Simples Nacional</option>
                  <option value="mei">MEI</option>
                  <option value="lucro_presumido">Lucro Presumido</option>
                  <option value="lucro_real">Lucro Real</option>
                  <option value="isento">Isento</option>
                  <option value="nao_identificado">Não sei / Outro</option>
                </select>
                {form1.formState.errors.regime && (
                  <p className="text-red-500 text-xs mt-1">{form1.formState.errors.regime.message}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-br from-blue-600 to-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold hover:from-blue-500 hover:to-blue-700 transition-all shadow-sm shadow-blue-600/20 mt-2"
              >
                Próximo
              </button>
            </form>
          )}

          {/* Etapa 2 */}
          {etapa === 2 && (
            <form onSubmit={form2.handleSubmit(handleEtapa2)} className="space-y-4">
              <div>
                <label className={labelCls}>Setor de Atividade</label>
                <select {...form2.register('setor')} className={inputCls}>
                  <option value="">Selecione o setor</option>
                  <option value="industria">Indústria</option>
                  <option value="comercio_atacado">Comércio Atacado</option>
                  <option value="comercio_varejo">Comércio Varejo</option>
                  <option value="servicos">Serviços Gerais</option>
                  <option value="servicos_saude">Serviços de Saúde</option>
                  <option value="servicos_educacao">Serviços de Educação</option>
                  <option value="servicos_financeiros">Serviços Financeiros</option>
                  <option value="agronegocio">Agronegócio</option>
                  <option value="construcao_civil">Construção Civil</option>
                  <option value="transporte">Transporte</option>
                  <option value="tecnologia">Tecnologia</option>
                  <option value="misto">Misto</option>
                </select>
                {form2.formState.errors.setor && (
                  <p className="text-red-500 text-xs mt-1">{form2.formState.errors.setor.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>UF</label>
                  <select {...form2.register('uf')} className={inputCls}>
                    <option value="">UF</option>
                    {UFS.map((uf) => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Município</label>
                  <input
                    {...form2.register('municipio')}
                    placeholder="São Paulo"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Faturamento Anual (R$)</label>
                <input
                  type="number"
                  {...form2.register('faturamentoAnual', { valueAsNumber: true })}
                  placeholder="1000000"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Alíquota ICMS (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    {...form2.register('aliquotaIcmsAtual', { valueAsNumber: true })}
                    placeholder="12"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Alíquota ISS (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    {...form2.register('aliquotaIssAtual', { valueAsNumber: true })}
                    placeholder="5"
                    className={inputCls}
                  />
                </div>
              </div>

              {erro && (
                <div className="p-3 bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
                  {erro}
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setEtapa(1)}
                  className="flex-1 border border-border text-foreground py-2.5 rounded-xl text-sm font-medium hover:bg-accent/50 transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={enviando}
                  className="flex-1 bg-gradient-to-br from-blue-600 to-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold hover:from-blue-500 hover:to-blue-700 transition-all shadow-sm shadow-blue-600/20 disabled:opacity-60"
                >
                  {enviando ? 'Criando...' : 'Criar meu perfil'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
