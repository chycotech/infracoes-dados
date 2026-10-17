// ---------------------------------------------------------------------------
// Acrescenta este método à classe que já expões ao WebView como "Android"
// (a mesma onde vive o abrirBrowser). Não é uma classe nova para registar:
// é um método a mais na que já tens.
//
// Porquê em Java e não em JavaScript: a WebView carregada dos assets tem
// origem "null", e o navegador recusa pedidos dessa origem para um servidor
// externo. Dava para destravar na configuração da WebView, mas isso abria a
// app a qualquer servidor. Assim o pedido sai daqui, e só para a ASF.
//
// Precisas destes imports no topo do ficheiro:
//
//   import android.webkit.JavascriptInterface;
//   import android.webkit.WebView;
//   import java.io.BufferedReader;
//   import java.io.InputStream;
//   import java.io.InputStreamReader;
//   import java.net.HttpURLConnection;
//   import java.net.URL;
//   import java.util.concurrent.ExecutorService;
//   import java.util.concurrent.Executors;
//   import org.json.JSONObject;
//
// E de um campo na classe, ao lado do WebView que já lá tens:
//
//   private final ExecutorService filaSeguro = Executors.newSingleThreadExecutor();
//
// A permissão de internet já a tens — é a mesma que descarrega os dados do
// GitHub. Não é preciso mexer no AndroidManifest.
// ---------------------------------------------------------------------------

/**
 * Consulta o ficheiro de seguro automóvel da ASF.
 *
 * Chamado pelo ecrã Seguro da aplicação. Faz o pedido numa linha de execução
 * própria — nunca na do ecrã — e devolve a resposta em bruto ao JavaScript,
 * que a interpreta. Aqui não se decide nada sobre o conteúdo: este método
 * transporta, não julga.
 *
 * @param url endereço construído pelo JavaScript; só se aceita o da ASF
 * @param id  número do pedido, para o JavaScript casar resposta com pergunta
 */
@JavascriptInterface
public void consultarSeguro(final String url, final int id) {
    filaSeguro.execute(new Runnable() {
        @Override
        public void run() {
            String corpo = null;
            HttpURLConnection ligacao = null;
            try {
                // O endereço vem do JavaScript. Mesmo sendo o nosso, confirma-se
                // aqui o destino: esta ponte serve a ASF e mais nada.
                if (url == null || !url.startsWith("https://ext01.asf.com.pt/api/")) {
                    responderSeguro(id, null);
                    return;
                }
                ligacao = (HttpURLConnection) new URL(url).openConnection();
                ligacao.setRequestMethod("GET");
                ligacao.setConnectTimeout(12000);
                ligacao.setReadTimeout(12000);
                ligacao.setRequestProperty("Accept", "application/json");

                int estado = ligacao.getResponseCode();
                // Em erro, a ASF ainda manda corpo útil (é lá que vem o
                // "Serviço Indisponível" do limite de consultas), por isso
                // lê-se também o fluxo de erro.
                InputStream fluxo = (estado >= 200 && estado < 300)
                        ? ligacao.getInputStream()
                        : ligacao.getErrorStream();

                if (fluxo != null) {
                    StringBuilder texto = new StringBuilder();
                    BufferedReader leitor =
                            new BufferedReader(new InputStreamReader(fluxo, "UTF-8"));
                    String linha;
                    while ((linha = leitor.readLine()) != null) texto.append(linha);
                    leitor.close();
                    corpo = texto.toString();
                }
            } catch (Exception e) {
                // Sem rede, servidor em baixo, tempo esgotado: devolve-se nada.
                // O ecrã mostra POR CONFIRMAR e manda o agente à FGA, que é o
                // comportamento certo quando não há resposta fiável.
                corpo = null;
            } finally {
                if (ligacao != null) ligacao.disconnect();
            }
            responderSeguro(id, corpo);
        }
    });
}

/** Devolve a resposta ao JavaScript, já na linha de execução do ecrã. */
private void responderSeguro(final int id, final String corpo) {
    // JSONObject.quote trata das aspas e dos acentos — a resposta da ASF traz
    // texto com acentuação escapada e não pode ser colada à bruta no código.
    final String argumento = (corpo == null) ? "null" : JSONObject.quote(corpo);
    webView.post(new Runnable() {
        @Override
        public void run() {
            webView.evaluateJavascript(
                    "respostaSeguro(" + id + "," + argumento + ")", null);
        }
    });
}
