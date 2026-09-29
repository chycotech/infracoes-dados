#!/usr/bin/env python3
"""
Gera o indice.json de pesquisa da ETR Chaves.

    python3 gerar_indice.py            # le os .json da pasta onde esta
    python3 gerar_indice.py dados      # le os .json da pasta "dados"

Descobre sozinho os ficheiros de dados e o tipo de conteudo de cada um.
Para dar um nome bonito a um ficheiro novo, acrescenta-o a ROTULOS.
Escreve tambem versao-dados.json, o carimbo que a app usa para saber se
precisa de voltar a descarregar os dados.
NAO editar o indice.json a mao: correr este script sempre que os dados mudarem.
"""
import hashlib, json, re, sys, unicodedata
from datetime import datetime, timezone
from pathlib import Path

# Nome a mostrar nos resultados de pesquisa. Ficheiros que nao estejam aqui
# recebem um nome derivado do proprio nome do ficheiro.
ROTULOS = {
    'dados':         'Código da Estrada',
    'velocipedes':   'Velocípedes',
    'peoes':         'Peões',
    'animais':       'Animais',
    'sinais':        'R.S.T. — sinais',
    'rst':           'R.S.T.',
    'rce':           'Regulamento do C.E.',
    'complegis':     'Legislação complementar',
    'fisctecnica':   'Fiscalização técnica',
    'alcoolemia':    'Alcoolemia',
    'easypark':      'EasyPark',
    'links':         'Consultas web',
    'procedimentos': 'Procedimentos',
}

# Ficheiros que nao sao dados de conteudo.
IGNORAR = {'indice', 'versao-dados', 'versao', 'sinonimos', 'package', 'package-lock', 'manifest', 'config', 'tsconfig', 'alcoolemia'}

TAM_TITULO = 110

VAZIAS = set(
    'de do da das dos e ou em no na nos nas a o as os um uma ao aos por para com sem '
    'que se nao pelo pela pelos pelas seu sua seus suas este esta esse essa isso aquele '
    'mesmo mesma quando onde ser sendo seja sejam tenha tendo tem sao foi era bem como '
    'mais menos muito pouco ja ainda entre sobre sob apos antes durante cada qualquer'.split())


def normalizar(txt):
    """Minusculas, sem acentos, sem pontuacao (excepto os pontos dos codigos)."""
    t = unicodedata.normalize('NFD', str(txt or '').lower())
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9.\s]', ' ', t)).strip()


def termos(texto_normalizado):
    """Termos distintos, pela ordem de aparicao, sem palavras vazias."""
    vistos, saida = set(), []
    for t in texto_normalizado.split():
        t = t.strip('.')
        if not t or t in vistos or t in VAZIAS:
            continue
        if len(t) <= 2 and not t.isdigit():
            continue
        vistos.add(t)
        saida.append(t)
    return ' '.join(saida)


def titulo_de(txt):
    t = re.sub(r'\s+', ' ', str(txt or '').strip())
    if len(t) <= TAM_TITULO:
        return t
    corte = t.rfind(' ', 0, TAM_TITULO)
    return t[:corte if corte > 60 else TAM_TITULO].rstrip(' ,;') + '…'


def primeiro(item, *chaves):
    for k in chaves:
        v = item.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ''


def artigo_de(codigo):
    """1.86.027.01.09 -> '27.º/1 27'. Devolve '' noutros formatos."""
    p = codigo.split('.')
    if len(p) == 5 and p[2].isdigit() and p[3].isdigit():
        return f'{int(p[2])}.º/{int(p[3])} {int(p[2])}'
    return ''


def tipo_de(item):
    if 'designacao' in item or 'codigoCE' in item:
        return 'sinal'
    if ('url' in item or 'link' in item) and 'codigo' not in item:
        return 'consulta'
    return 'infracao'


def rotulo_de(nome):
    if nome in ROTULOS:
        return ROTULOS[nome]
    return nome.replace('-', ' ').replace('_', ' ').capitalize()


def ler_sinonimos(pasta):
    """sinonimos.json: {"termos": [ids]} -> {id: "termos"}"""
    caminho = pasta / 'sinonimos.json'
    if not caminho.exists():
        return {}
    por_id = {}
    for chave, ids in json.loads(caminho.read_text(encoding='utf-8')).items():
        if chave.startswith('_') or not isinstance(ids, list):
            continue
        for i in ids:
            por_id[i] = (por_id.get(i, '') + ' ' + chave).strip()
    return por_id


def entradas(caminho, sinonimos, problemas):
    nome = caminho.stem
    fonte, rotulo = nome, rotulo_de(nome)
    try:
        dados = json.loads(caminho.read_text(encoding='utf-8'))
    except json.JSONDecodeError as e:
        problemas.append(f'{caminho.name}: JSON invalido — linha {e.lineno}, {e.msg}')
        return
    if isinstance(dados, dict):
        dados = next((v for v in dados.values() if isinstance(v, list)), [])
    if not isinstance(dados, list):
        return

    for item in dados:
        if not isinstance(item, dict):
            continue
        tipo = tipo_de(item)
        ident = primeiro(item, 'codigo', 'codigoCE', 'id', 'url', 'link')
        titulo = titulo_de(primeiro(item, 'designacao', 'descricao', 'titulo', 'nome', 'texto'))
        if not titulo or not ident:
            continue
        categoria = primeiro(item, 'categoria', 'tipo', 'grupo', 'seccao')
        extra = ' '.join(str(v) for k, v in item.items()
                         if isinstance(v, str) and k not in ('codigo', 'descricao', 'designacao'))
        yield {
            'f': fonte,
            'c': ident,
            'y': tipo,
            't': titulo,
            'g': categoria,
            'r': rotulo,
            'b': termos(normalizar(f'{ident} {titulo} {categoria} {extra} '
                                   f'{artigo_de(ident)} {sinonimos.get(ident, "")}')),
        }


def main():
    pasta = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent
    saida = pasta / 'indice.json'

    sinonimos = ler_sinonimos(pasta)
    indice, problemas = [], []

    ficheiros = sorted(f for f in pasta.glob('*.json') if f.stem not in IGNORAR)
    if not ficheiros:
        print(f'Nenhum .json encontrado em {pasta.resolve()}')
        sys.exit(1)

    for f in ficheiros:
        antes = len(indice)
        indice.extend(entradas(f, sinonimos, problemas))
        n = len(indice) - antes
        print(f'  {f.name:<32} {n:>5}' + ('   (sem itens indexaveis)' if n == 0 else ''))

    saida.write_text(json.dumps(indice, ensure_ascii=False, separators=(',', ':')),
                     encoding='utf-8')

    # Carimbo dos dados: muda sempre que o conteudo muda, para a app saber que
    # tem de voltar a descarregar. Nada a ver com a versao da aplicacao.
    corpo = json.dumps(indice, ensure_ascii=False, sort_keys=True).encode('utf-8')
    carimbo = {
        'gerado': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'impressao': hashlib.sha256(corpo).hexdigest()[:12],
        'entradas': len(indice),
        'ficheiros': {f.name: sum(1 for e in indice if e['f'] == f.stem) for f in ficheiros},
    }
    (pasta / 'versao-dados.json').write_text(
        json.dumps(carimbo, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    usados = {e['c'] for e in indice}
    orfaos = [i for i in sinonimos if i not in usados]
    print(f'\n  {saida.name}  —  {len(indice)} entradas, '
          f'{saida.stat().st_size / 1024:.0f} KB')
    print(f"  versao-dados.json  —  impressao {carimbo['impressao']}")
    if sinonimos:
        print(f'  sinonimos aplicados a {len(sinonimos) - len(orfaos)} itens')
    if orfaos:
        print(f'  ! sinonimos para itens inexistentes: {orfaos}')
    for p in problemas:
        print(f'  ! {p}')
    if problemas:
        sys.exit(1)


if __name__ == '__main__':
    main()
