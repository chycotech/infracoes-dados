/* ===========================================================================
   ETR Chaves — detalhe.js
   Desenha o ecra de detalhe de uma infracao ou de um sinal.

   COMO USAR
   ---------
       <script src="detalhe.js"></script>

       document.getElementById('caixa').innerHTML =
           ETRDetalhe.html(registo, { fonte: 'ce', favorito: false });

   O registo e um objecto vindo dos ficheiros de dados. O modulo reconhece
   sozinho se e infracao ou sinal, e so mostra os campos que existirem.

   NOTA  A hifenacao so funciona se o documento declarar o idioma:
         <html lang="pt-PT">

   GANCHOS (ligar as funcoes da app, opcional)
   -------
       ETRDetalhe.aoAlternarFavorito = function (fonte, codigo) { ... };
       ETRDetalhe.aoAbrirCodigo      = function (codigo) { ... };  // saltar
   =========================================================================== */
(function (global) {
  'use strict';

  /* Campos opcionais das infracoes, pela ordem em que devem aparecer.
     So aparecem se o registo os tiver preenchidos. Acrescentar aqui um campo
     novo chega para ele passar a ser mostrado. */
  var CAMPOS = [
    ['punicao',             'Punição'],
    ['pontos',              'Pontos'],
    ['sancao_acessoria',    'Sanção acessória'],
    ['apreensao',           'Apreensão'],
    ['guia_substituicao',   'Guia de substituição'],
    ['garantia_cumprimento','Garantia de cumprimento'],
    ['reboque',             'Reboque'],
    ['redacao',             'Redação para o auto'],
    ['jurisprudencia',      'Jurisprudência'],
    ['observacoes',         'Observações'],
    ['diploma',             'Diploma']
  ];

  var CLASSE = {
    'LEVE':        'g-leve',
    'GRAVE':       'g-grave',
    'MUITO GRAVE': 'g-muito-grave'
  };

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function temValor(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return String(v).trim() !== '';
  }

  /* A sancao acessoria vem toda numa linha, separada por barras verticais.
     Parte-se nessas barras para se poder ler. Remove-se o prefixo repetido
     "Sancao acessoria:" que ja e o titulo do bloco. */
  function partes(texto) {
    return String(texto)
      .split('|')
      .map(function (p) {
        return p.replace(/^\s*San[çc][ãa]o acess[óo]ria\s*:?\s*-?\s*/i, '').trim();
      })
      .filter(function (p) { return p !== ''; });
  }

  function linhas(valor) {
    var lista = Array.isArray(valor) ? valor : partes(valor);
    if (lista.length <= 1) return '<p class="d-txt">' + esc(lista[0] || valor) + '</p>';
    return '<ul class="d-lista">' +
      lista.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') +
      '</ul>';
  }

  function bloco(rotulo, conteudo) {
    return '<div class="d-bloco"><h4>' + esc(rotulo) + '</h4>' + conteudo + '</div>';
  }

  function estrela(fonte, codigo, activo) {
    return '<button class="d-fav" aria-pressed="' + (activo ? 'true' : 'false') +
      '" aria-label="' + (activo ? 'Retirar dos favoritos' : 'Guardar nos favoritos') + '"' +
      ' onclick="ETRDetalhe._fav(this,\'' + esc(fonte) + '\',\'' + esc(codigo) + '\')">' +
      '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.5 5.9.8-4.3 4.2 1 6-5.2-2.8L6.8 20l1-6-4.3-4.2 5.9-.8z"/></svg>' +
      '</button>';
  }

  /* ------------------------------------------------------------- infracao */

  function htmlInfracao(r, op) {
    var cod = r.codigo || '';
    var cls = CLASSE[String(r.classificacao || '').toUpperCase()] || '';
    var h = '';

    h += '<div class="d-topo">' +
           '<div class="d-topo-txt">' +
             (temValor(r.categoria) ? '<p class="d-cat">' + esc(r.categoria) + '</p>' : '') +
             '<h3 class="d-desc">' + esc(r.descricao) + '</h3>' +
           '</div>' +
           estrela(op.fonte, cod, op.favorito) +
         '</div>';

    h += '<div class="d-chips">';
    if (temValor(r.classificacao)) h += '<span class="d-chip ' + cls + '">' + esc(r.classificacao) + '</span>';
    if (temValor(r.coima))         h += '<span class="d-chip d-coima">' + esc(r.coima) + '</span>';
    if (temValor(r.infracao))      h += '<span class="d-chip">' + esc(r.infracao) + '</span>';
    h += '</div>';

    if (cod) h += '<p class="d-codigo">' + esc(cod) + '</p>';

    for (var i = 0; i < CAMPOS.length; i++) {
      var k = CAMPOS[i][0];
      if (temValor(r[k])) h += bloco(CAMPOS[i][1], linhas(r[k]));
    }

    if (temValor(r.sinais)) h += bloco('Sinais relacionados', atalhos(r.sinais));
    return h;
  }

  /* ---------------------------------------------------------------- sinal */

  function htmlSinal(r, op) {
    var cod = r.codigo || r.codigoCE || '';
    var h = '';

    h += '<div class="d-topo">' +
           '<div class="d-topo-txt">' +
             (temValor(r.tipo) ? '<p class="d-cat">' + esc(r.tipo) + '</p>' : '') +
             '<h3 class="d-desc">' + esc(r.designacao || r.nome) + '</h3>' +
           '</div>' +
           estrela(op.fonte || 'sinais', cod, op.favorito) +
         '</div>';

    if (temValor(r.imagem)) {
      h += '<div class="d-img"><img src="' + esc(r.imagem) + '" alt="' + esc(r.designacao) + '"></div>';
    }

    h += '<div class="d-chips">' +
         (cod ? '<span class="d-chip d-sinal">' + esc(cod) + '</span>' : '') +
         (temValor(r.artigo) ? '<span class="d-chip">Artigo ' + esc(r.artigo) + '</span>' : '') +
         (temValor(r.categoria) ? '<span class="d-chip">' + esc(r.categoria) + '</span>' : '') +
         '</div>';

    if (temValor(r.significado)) h += bloco('Significado', '<p class="d-txt">' + esc(r.significado) + '</p>');
    if (temValor(r.enquadramento)) h += bloco('Enquadramento', '<p class="d-txt">' + esc(r.enquadramento) + '</p>');
    if (temValor(r.infracoes)) h += bloco('Infrações relacionadas', atalhos(r.infracoes));
    return h;
  }

  function atalhos(lista) {
    return '<div class="d-atalhos">' + lista.map(function (c) {
      return '<button class="d-atalho" onclick="ETRDetalhe._ir(\'' + esc(c) + '\')">' +
             esc(c) + '</button>';
    }).join('') + '</div>';
  }

  /* -------------------------------------------------------------- publico */

  var ETRDetalhe = {

    aoAlternarFavorito: null,
    aoAbrirCodigo: null,

    ehSinal: function (r) {
      return !!(r && (r.designacao || r.codigoCE)) && !r.coima;
    },

    html: function (registo, opcoes) {
      if (!registo) return '<p class="d-txt">Registo não encontrado.</p>';
      var op = opcoes || {};
      return '<div class="detalhe">' +
        (ETRDetalhe.ehSinal(registo) ? htmlSinal(registo, op) : htmlInfracao(registo, op)) +
        '</div>';
    },

    _fav: function (el, fonte, codigo) {
      var activo = el.getAttribute('aria-pressed') === 'true';
      el.setAttribute('aria-pressed', activo ? 'false' : 'true');
      el.setAttribute('aria-label', activo ? 'Guardar nos favoritos' : 'Retirar dos favoritos');
      if (ETRDetalhe.aoAlternarFavorito) ETRDetalhe.aoAlternarFavorito(fonte, codigo, !activo);
    },

    _ir: function (codigo) {
      if (ETRDetalhe.aoAbrirCodigo) ETRDetalhe.aoAbrirCodigo(codigo);
    },

    /* Folha de estilo do modulo. Usa as variaveis de cor da app; se nao
       existirem, ha valores de recurso. Chamar uma vez no arranque. */
    estilo: function () {
      return [
        '.detalhe{padding:2px 0}',
        '.d-topo{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px}',
        '.d-topo-txt{flex:1;min-width:0}',
        '.d-cat{margin:0 0 5px;font-size:.78rem;color:var(--cyan,#38bdf8);letter-spacing:.02em}',
        '.d-desc{margin:0;font-size:1.06rem;font-weight:600;line-height:1.4;',
        '  hyphens:auto;-webkit-hyphens:auto;overflow-wrap:break-word}',
        '.d-fav{flex:none;width:42px;height:42px;display:flex;align-items:center;justify-content:center;',
        '  border:1px solid var(--line,#1d3c57);border-radius:11px;background:none;cursor:pointer}',
        '.d-fav svg{width:20px;height:20px;stroke:#5f7f99;fill:none;stroke-width:1.7;stroke-linejoin:round}',
        '.d-fav[aria-pressed="true"] svg{stroke:var(--cyan,#38bdf8);fill:var(--cyan,#38bdf8)}',
        '.d-chips{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:12px}',
        '.d-chip{font-size:.78rem;padding:5px 11px;border-radius:99px;border:1px solid var(--line,#1d3c57);color:var(--muted,#8AA6BE)}',
        '.d-coima{color:var(--text,#e6eef5);font-variant-numeric:tabular-nums}',
        '.d-sinal{font-family:ui-monospace,monospace;color:var(--cyan,#38bdf8);border-color:var(--cyan-dim,#1d6d99)}',
        '.g-leve{color:#22c55e;border-color:rgba(34,197,94,.45);background:rgba(34,197,94,.09)}',
        '.g-grave{color:#f5b642;border-color:rgba(245,182,66,.45);background:rgba(245,182,66,.09)}',
        '.g-muito-grave{color:#ef6a6a;border-color:rgba(239,106,106,.45);background:rgba(239,106,106,.1)}',
        '.d-codigo{margin:0 0 18px;font-family:ui-monospace,monospace;font-size:1.02rem;',
        '  letter-spacing:.06em;color:var(--cyan,#38bdf8)}',
        '.d-bloco{border-top:1px solid var(--line,#1d3c57);padding:13px 0}',
        '.d-bloco h4{margin:0 0 6px;font-size:.76rem;font-weight:600;color:var(--muted,#8AA6BE);',
        '  text-transform:none;letter-spacing:.02em}',
        '.d-txt{margin:0;font-size:.92rem;line-height:1.55;',
        '  hyphens:auto;-webkit-hyphens:auto;overflow-wrap:break-word}',
        '.d-lista{margin:0;padding-left:18px;font-size:.92rem;line-height:1.6;',
        '  hyphens:auto;-webkit-hyphens:auto;overflow-wrap:break-word}',
        '.d-lista li{margin-bottom:3px}',
        '.d-img{margin-bottom:14px;text-align:center}',
        '.d-img img{max-width:150px;max-height:150px}',
        '.d-atalhos{display:flex;flex-wrap:wrap;gap:7px}',
        '.d-atalho{font-family:ui-monospace,monospace;font-size:.8rem;padding:6px 11px;border-radius:9px;',
        '  border:1px solid var(--cyan-dim,#1d6d99);color:var(--cyan,#38bdf8);background:none;cursor:pointer}',
        '.d-atalho:hover{background:rgba(56,189,248,.12)}'
      ].join('');
    }
  };

  global.ETRDetalhe = ETRDetalhe;

})(typeof window !== 'undefined' ? window : this);
