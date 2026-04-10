import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(valor)
}

export function formatarPercentual(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor / 100)
}

export function normalizarCnpj(cnpj: string): string | null {
  const limpo = cnpj.replace(/\D/g, '')
  // Excel frequentemente remove zeros à esquerda de CNPJs (ex: 07.xxx → 7xxx = 13 dígitos)
  // Repadding para 14 dígitos recupera esses casos
  if (limpo.length < 11 || limpo.length > 14) return null
  return limpo.padStart(14, '0')
}

export function formatarCnpj(cnpj: string): string {
  const limpo = cnpj.replace(/\D/g, '').padStart(14, '0')
  return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function validarCnpj(cnpj: string): boolean {
  const limpo = cnpj.replace(/\D/g, '')
  if (limpo.length !== 14) return false
  if (/^(\d)\1+$/.test(limpo)) return false

  const calcDig = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((acc, d, i) => acc + parseInt(d) * pesos[i], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  const d1 = calcDig(limpo.slice(0, 12), pesos1)
  const d2 = calcDig(limpo.slice(0, 13), pesos2)

  return parseInt(limpo[12]) === d1 && parseInt(limpo[13]) === d2
}

export function labelRegime(regime: string): string {
  const labels: Record<string, string> = {
    simples_nacional: 'Simples Nacional',
    mei: 'Simples - MEI',
    lucro_presumido: 'Lucro Real/Presumido',
    lucro_real: 'Lucro Real',
    nanoempreendedor: 'Nanoempreendedor',
    isento: 'Isento',
    nao_identificado: 'Não Identificado',
  }
  return labels[regime] ?? regime
}

export function labelSetor(setor: string): string {
  const labels: Record<string, string> = {
    industria: 'Indústria',
    comercio_atacado: 'Comércio Atacado',
    comercio_varejo: 'Comércio Varejo',
    servicos: 'Serviços',
    hotelaria: 'Hotelaria',
    parques_diversao: 'Parques de Diversão / Temáticos',
    servicos_saude: 'Serviços de Saúde',
    servicos_educacao: 'Serviços de Educação',
    servicos_financeiros: 'Serviços Financeiros',
    fii_fiagro: 'FII / Fiagro',
    telecomunicacoes: 'Telecomunicações',
    entidades_desportivas: 'Atividades Desportivas',
    entidades_religiosas: 'Entidades Religiosas',
    agronegocio: 'Agronegócio',
    profissionais_liberais: 'Profissionais Liberais',
    construcao_civil: 'Construção Civil',
    construcao_edificios: 'Construção de Edifícios',
    construcao_infraestrutura: 'Obras de Infraestrutura',
    construcao_servicos_especializados: 'Serv. Especializados de Construção',
    transporte_coletivo_passageiros: 'Transp. Coletivo de Passageiros',
    transporte_cargas: 'Transporte de Cargas / Aéreo',
    imoveis: 'Atividades Imobiliárias',
    combustiveis_energia: 'Combustíveis e Energia',
    transporte: 'Transporte',
    tecnologia: 'Tecnologia',
    misto: 'Misto',
  }
  return labels[setor] ?? setor
}
