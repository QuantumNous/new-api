/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
/* eslint-disable no-irregular-whitespace */
import type { LegalDocumentKind } from './default-documents'

export const PT_DEFAULT_LEGAL_DOCUMENTS: Record<LegalDocumentKind, string> = {
  terms: `# Contrato do usuário flatkey.ai

Última atualização: 4 de junho de 2026

Este Contrato de Usuário ("Contrato") se aplica aos serviços flatkey.ai fornecidos por VOC AI INC ("VOC AI", "nós", "nos" ou "nosso") por meio de flatkey.ai, o painel, APIs, páginas de checkout, documentação e canais de suporte (os "Serviços"). Ao registrar uma conta, criar uma organização, adicionar saldo de conta pré-paga, gerar ou usar uma chave API, ligar para o modelo APIs, acessar o painel ou usar os Serviços de outra forma, você concorda com este Contrato, nossa Política de Privacidade, Política de Reembolso, documentação, páginas de preços e quaisquer regras complementares aplicáveis.

Entidade operacional: VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, Estados Unidos. Contato: support@flatkey.ai.

## 1. Visão geral do serviço

flatkey.ai é um acesso AI API, roteamento de modelo, medição de uso, painel e serviço de saldo de conta pré-paga. Os usuários podem acessar diferentes recursos do modelo AI por meio de um API e painel unificado, gerenciar chaves API, permissões de equipe, seleção de modelo, solicitar registros, saldos, créditos, cobrança e assuntos de suporte.

flatkey.ai não é o modelo em si. Não garantimos que qualquer modelo específico, API, preço, janela de contexto, limite de taxa, disponibilidade regional, comportamento de saída, regra de processamento de dados ou política de terceiros permanecerão disponíveis ou inalterados. Podemos adicionar, remover, restringir ou modificar modelos, recursos, preços e regras de uso com base nas necessidades do produto, alterações de custos, requisitos de segurança, obrigações de conformidade, requisitos do fornecedor de modelo ou alterações em serviços de terceiros.

## 2. Elegibilidade, contas e organizações

Você deve ter pelo menos 13 anos. Se você tiver menos de 18 anos, deverá ter permissão de seus pais ou responsável legal. Se você usar os Serviços em nome de uma empresa, organização ou outra entidade, você declara ter autoridade para aceitar este Contrato em nome dessa entidade.

Você deve fornecer informações verdadeiras, precisas, completas e atuais sobre conta, negócios, cobrança, impostos e contato. Você é responsável pelos administradores, membros, aplicativos, chaves API, credenciais de acesso, solicitações, integrações, métodos de pagamento e uso do saldo em sua conta.

Os administradores da organização podem convidar membros da equipe e configurar permissões, orçamentos, modelos, logs, chaves e configurações de segurança. As configurações do administrador podem afetar os membros da organização e os usuários finais do seu aplicativo. Você deve garantir que os membros da sua equipe e usuários finais cumpram este Contrato, nossa documentação e os termos aplicáveis ​​do fornecedor modelo.

Se você acredita que sua conta, chave API, credencial de acesso, método de pagamento ou acesso ao painel foram usados ​​sem autorização, você deve entrar em contato conosco imediatamente e tomar as medidas apropriadas para revogar, alternar, desabilitar ou restringir o acesso.

## 3. Saldo pré-pago, taxas e entrega digital

Os Serviços podem exigir que você adquira saldo de conta pré-pago ou créditos de serviço antes de ligar para APIs ou usar determinados recursos. Antes da compra, você terá a oportunidade de revisar o valor do pedido, moeda, impostos, taxas, forma de pagamento e regras de preços mostradas na página aplicável.

O saldo da conta e os créditos de serviço podem ser usados ​​apenas para Serviços flatkey.ai elegíveis. Não são dinheiro, depósitos, dinheiro eletrônico, cartões-presente, instrumentos de pagamento, contas sacáveis ​​ou produtos financeiros. A menos que concordemos expressamente por escrito ou a lei aplicável exija o contrário, o saldo da conta e os créditos de serviço não podem ser sacados, resgatados por dinheiro, cedidos, usados ​​como garantia, investidos ou usados ​​fora dos Serviços.

Após o pagamento bem-sucedido ou a aprovação do pedido, o saldo ou os créditos adquiridos geralmente são entregues eletronicamente em sua conta e podem ser usados ​​imediatamente para solicitações API, chamadas de modelo ou outros recursos pagos. Quando você faz uma solicitação, o sistema deduz o saldo de acordo com o preço do modelo atual, uso de entrada, uso de saída, acessos de cache, solicitações, arquivos, imagens, impostos, taxas, conversão de moeda e quaisquer outras regras de cobrança mostradas na página relevante ou no fluxo de checkout.

O período de expiração do saldo ou créditos é determinado pela página de compra, descrição do pedido, exibição do painel ou confirmação por escrito nossa. Podemos restringir, congelar, cancelar ou tratar, de acordo com a Política de Reembolso, qualquer saldo ou créditos associados a contas inativas há muito tempo, contas suspensas, contas encerradas, atividades fraudulentas ou violações de políticas.

## 4. Pagamentos, Impostos e Faturas

Você autoriza a VOC AI e nossos provedores de serviços de pagamento a cobrar no método de pagamento selecionado os valores dos pedidos, impostos, taxas e outros encargos aplicáveis. Os pagamentos podem ser processados ​​por Paddle, Stripe, bancos, redes de cartões, carteiras, fornecedores locais de métodos de pagamento, fornecedores antifraude, fornecedores de impostos, fornecedores de faturas ou outros prestadores de serviços necessários.

Dependendo do método de checkout, a parte responsável pela cobrança, faturamento, cálculo de impostos, execução do reembolso e tratamento de disputas pode variar. Se Paddle processar um pedido como comerciante registrado ou vendedor, Paddle poderá ser responsável pela cobrança de pagamentos, impostos, faturas, recibos, reembolsos e fluxos de trabalho de disputa de pagamento. Se a Stripe ou outro provedor atuar apenas como processador de pagamentos, a VOC AI poderá continuar sendo a vendedora e o processador poderá lidar com atividades relacionadas ao pagamento em nosso nome.

Você deve fornecer endereço de cobrança preciso, nome da empresa, identificação fiscal, informações de IVA/GST, endereço de e-mail e informações de fatura. Você é responsável por impostos, questões de faturas, problemas de recebimento, falhas de pagamento, atrasos em reembolsos, revisões de conformidade ou custos adicionais causados ​​por informações imprecisas, incompletas ou desatualizadas.

## 5. Termos e restrições do fornecedor modelo

Os Serviços podem permitir que você, os membros de sua equipe, seus aplicativos ou seus usuários finais acessem modelos, APIs, ferramentas ou recursos fornecidos por fornecedores de modelos terceirizados ou prestadores de serviços técnicos. Você entende e concorda que o uso de qualquer modelo ou serviço de terceiros também pode estar sujeito aos termos, políticas, restrições regionais, regras de segurança, regras de processamento de dados e limitações de uso desse modelo ou serviço de terceiros.

Você é responsável por confirmar, antes de usar um modelo específico, se o modelo e suas regras são adequados para seu caso de uso, incluindo uso comercial, uso voltado para o cliente, dados confidenciais, setores regulamentados, decisões de alto risco, acesso regional, menores, segurança de conteúdo e publicação de resultados. Você também deve garantir que os membros da sua equipe e usuários finais usem modelos relevantes de acordo com este Contrato, nossa documentação e regras aplicáveis ​​de terceiros.

Certos modelos ou recursos podem não permitir o acesso por determinadas regiões, indústrias, entidades, finalidades ou tipos de solicitação. Você não pode usar VPNs, proxies, múltiplas contas, informações falsas, soluções técnicas ou outros métodos para contornar restrições de modelo, regionais, de identidade, segurança ou conformidade. Poderemos suspender, restringir, fechar ou remover seu acesso a modelos, contas, chaves API, saldo ou recursos relevantes se recebermos uma solicitação de terceiros, detectarmos riscos ou acreditarmos razoavelmente que as regras foram violadas.

Não modificamos, renunciamos ou substituímos os termos do fornecedor modelo terceirizado. Os provedores de modelos podem alterar seus termos, preços, recursos, disponibilidade, métodos de processamento de dados ou restrições de acesso a qualquer momento. O uso continuado de um modelo significa que você aceita as regras aplicáveis ​​então vigentes.

## 6. Responsabilidade de configuração

Você é responsável por selecionar modelos, configurar contas, definir permissões de equipe, gerenciar chaves API, configurar orçamentos e limites de taxas, controlar fontes de solicitação, revisar entradas e saídas e determinar se os Serviços são adequados para o seu cenário de negócios.

Se você integrar o flatkey.ai ao seu próprio produto ou serviço, deverá manter o controle sobre seu aplicativo, acesso do usuário final, permissões de conta, chaves API, saldo, créditos, fontes de solicitação, registros, tratamento de abusos e suporte ao cliente. Você não pode permitir que os usuários finais obtenham, controlem, revendam, dividam, usem em massa ou ignorem diretamente seu aplicativo para usar contas flatkey.ai, chaves API, saldo ou créditos.

Você é responsável pelos membros da sua equipe, aplicativos, integrações, usuários finais, scripts automatizados, configurações de permissão e gerenciamento de chaves. Uso, taxas, disputas ou perdas causadas por sua configuração, vazamento de chave, conduta do usuário final, configurações de permissão, erros de script ou problemas de gerenciamento interno são de sua responsabilidade, a menos que sejam causados ​​diretamente por nosso erro de sistema verificável.

## 7. Conteúdo do usuário e saída AI

Prompts, textos, arquivos, imagens, códigos, dados, configurações, solicitações e outros conteúdos que você envia aos Serviços são "Entradas". As respostas do modelo, o conteúdo gerado ou outros resultados retornados pelos Serviços são “Saídas”. Entradas e Saídas são coletivamente “Conteúdo do Usuário”.

Você retém os direitos que detém legalmente sobre suas informações. Para fornecer, encaminhar, medir, solucionar problemas, oferecer suporte, proteger, auditar, revisar reembolsos e melhorar os Serviços, você nos concede uma licença não exclusiva, mundial e isenta de royalties para processar, transmitir, armazenar, copiar, exibir e usar o Conteúdo do Usuário e metadados relacionados conforme necessário.

Você declara que possui todos os direitos, permissões e consentimentos necessários para enviar, processar e transmitir informações. Você não pode enviar conteúdo que viole direitos de propriedade intelectual, direitos de privacidade, obrigações de confidencialidade, obrigações contratuais ou lei aplicável.

As saídas AI podem ser imprecisas, incompletas, desatualizadas, repetitivas, tendenciosas, inseguras, inadequadas para uma finalidade específica ou semelhantes a conteúdo de terceiros. Você deve revisar e verificar os Resultados de forma independente antes de confiar neles, publicá-los, usá-los comercialmente, implantá-los na produção ou usá-los para decisões legais, médicas, financeiras, trabalhistas, de crédito, de segurança, de conformidade ou outras decisões importantes. Não garantimos a precisão, exclusividade, adequação, disponibilidade ou não violação de qualquer Resultado.

A menos que o painel, a documentação ou a descrição do pedido forneçam expressamente um recurso relevante, não prometemos armazenar o histórico completo de entradas ou saídas. Para fins de solução de problemas, segurança, medição, reembolso, disputa ou conformidade, poderemos reter metadados de solicitação, registros de erros, registros de uso e registros necessários.

## 8. Sem revenda, retransmissão ou uso competitivo

Contas flatkey.ai, chaves API, saldo de conta, créditos de serviço, capacidade de acesso de modelo e capacidade de painel são para uso por você e sua equipe autorizada em seu próprio negócio ou aplicação. A menos que celebremos um contrato separado por escrito, você não poderá fornecer flatkey.ai a terceiros como um API independente, saldo, crédito, subconta, serviço de recarga, serviço de retransmissão, serviço renomeado, serviço de agregação ou serviço semelhante, seja por venda, transferência, distribuição, aluguel, compartilhamento ou outro acordo indireto.

Você não pode acessar ou usar os Serviços com a finalidade de revender o acesso API, construir um serviço concorrente, contornar regras de modelo de terceiros, ocultar o verdadeiro usuário final, evitar preços ou limites, contornar restrições regionais, contornar a revisão de segurança ou contornar a revisão de pagamento.

Revenda não autorizada, retransmissão, compartilhamento de conta, ocultação do usuário verdadeiro, criação de conta em massa, chamadas concentradas anormais, evasão de limite ou evasão de controle de risco são violações materiais. Podemos suspender ou encerrar contas, chaves API, saldo, créditos e pedidos relacionados, e podemos negar ou limitar reembolsos, restauração de saldo ou ajustes de crédito relacionados.

## 9. Conduta Proibida

Você não pode:

- usar os Serviços para atividades ilegais, fraudulentas, infratoras, de assédio, spam, malware, phishing, ataque ao sistema, evasão regulatória, invasão de privacidade, extração de dados confidenciais, evasão de sanções, violação de controle de exportação ou outras atividades prejudiciais;
- criar identidades falsas, fazer-se passar por outras pessoas, deturpar afiliações ou usar múltiplas contas para evitar limites, controles de risco, preços, reembolsos ou revisão de conformidade;
- ignorar ou interferir nos limites da conta, limites regionais, regras de cobrança, limites de crédito, limites de taxas, mecanismos de segurança, regras antiabuso, restrições de serviços de terceiros ou processos de revisão de pagamentos;
- fazer engenharia reversa, digitalizar, atacar, testar o estresse, interromper, rastrear, copiar, raspar ou acessar sem autorização os Serviços, APIs, sistemas, dados ou contas de outros usuários;
- realizar testes adversários, injeção imediata, testes de jailbreak, testes de desvio de segurança, testes de estresse ou outros testes que possam prejudicar modelos, os Serviços, regras de terceiros ou interesses do usuário sem nossa aprovação por escrito;
- enviar ou distribuir conteúdo infrator, ilegal, malicioso, fraudulento, enganoso, de assédio, sexual, violento, odioso, invasivo à privacidade, restrito ou que viole políticas de terceiros;
- ajudar, encorajar ou permitir que qualquer terceiro faça qualquer uma das ações acima.

## 10. Registros de medição, entrega e revisão

Mantemos registros de pedido, pagamento, entrega, saldo, crédito, solicitação, dedução, erro, reembolso, estorno, disputa e segurança para verificar se a entrega foi concluída, se o uso ocorreu, se o saldo foi deduzido corretamente, se uma solicitação de reembolso é válida e se uma conta mostra uso anormal.

Envidamos esforços razoáveis ​​para manter os registros de medição e faturamento precisos, mas sistemas complexos podem sofrer atrasos, erros, registros duplicados ou diferenças de exibição. Se ocorrer um erro de sistema verificável, poderemos resolvê-lo através da restauração do saldo, correção de crédito, ajuste de faturamento ou reembolso. Capturas de tela de usuários, registros de terceiros ou registros locais podem ser considerados materiais de apoio, mas a revisão final considerará nossos registros de sistema, registros de provedores de serviços de pagamento e registros de serviços de terceiros necessários.

Para proteger a estabilidade do serviço e de outros usuários, poderemos monitorar solicitações anormais, deduções anormais, logins anormais, pagamentos anormais, chamadas em massa, vazamento de chaves, solicitações maliciosas, abuso de estorno e padrões de uso que violem este Contrato, e poderemos restringir temporariamente recursos relacionados durante uma investigação.

Podemos realizar análises manuais ou automatizadas de pedidos de alto risco, grandes recargas, frequência de recarga anormal, informações de faturamento inconsistentes, regiões de login anormais, fontes de solicitação anormais, alta simultaneidade de curto período ou alertas de provedores de serviços de pagamento. Durante a revisão, a entrega, o uso do saldo, os reembolsos, as faturas ou os recursos da conta podem ser atrasados ​​ou restritos. Após análise, restauraremos ou trataremos dos assuntos relevantes de acordo com os registros aplicáveis.

## 11. Reembolsos

Reembolsos, restauração de saldo, correções de crédito e ajustes de suporte são tratados de acordo com nossa Política de Reembolso flatkey.ai. Em geral, os créditos entregues e utilizados, o saldo consumido, as solicitações concluídas e os serviços digitais prestados com sucesso não são reembolsáveis.

Cobranças duplicadas, não entrega, erros de sistema verificáveis, saldo não utilizado, erros de impostos ou faturas, disputas de pagamento, direitos obrigatórios do consumidor ou requisitos do provedor de serviços de pagamento serão revisados ​​com base nos registros de pedidos, registros de entrega, registros de uso, status de pagamento e regras aplicáveis.

## 12. Serviços de terceiros

Os Serviços podem contar com modelos de terceiros, APIs, plataformas, serviços em nuvem, serviços de pagamento, serviços fiscais, serviços de fatura, hospedagem, bancos de dados, e-mail, análises, segurança e ferramentas de suporte. Terceiros prestam serviços e processam dados de acordo com seus próprios termos, políticas e regras técnicas.

Os serviços de terceiros podem ser suspensos, com taxas limitadas, rejeitados, descontinuados, reajustados, modificados, restringidos por região ou sujeitos a métodos de processamento de dados alterados. Faremos esforços razoáveis ​​para manter os Serviços, mas não garantimos a disponibilidade contínua de qualquer serviço de terceiros e não somos responsáveis, além deste Contrato, por falhas de terceiros, alterações de políticas, problemas de rede, restrições regionais, comportamento do modelo, qualidade de saída ou alterações de custos de terceiros.

## 13. Suspensão, rescisão e alterações no serviço

Se acreditarmos que você violou este Contrato ou políticas de terceiros, usou os Serviços ilegalmente, se envolveu em fraude, criou risco de sanções, causou risco de pagamento, abusou de estornos, criou risco de segurança, forneceu os Serviços a terceiros sem autorização, gerou uso anormal ou prejudicou a nós ou a terceiros, poderemos suspender ou encerrar contas, pedidos, chaves API, saldo, créditos, permissões de equipe ou acesso ao serviço.

Na medida máxima permitida pela lei aplicável, o saldo ou os créditos associados a fraude, abuso, violações de políticas, risco de sanções, uso ilegal, abuso de estorno, fornecimento não autorizado a terceiros ou incidentes graves de segurança podem ser restringidos, congelados, cancelados, recusados ​​na entrega ou não reembolsados.

Você pode parar de usar os Serviços. O encerramento da conta não afeta as obrigações de pagamento, a responsabilidade de uso, o tratamento de disputas, a revisão de conformidade, as obrigações de indenização ou as disposições deste Contrato que, por sua natureza, devem continuar a ser aplicadas.

Poderemos modificar, suspender ou descontinuar parte ou todos os Serviços, modelos, recursos, preços, documentação ou métodos de acesso. A menos que a lei aplicável ou a Política de Reembolso exijam o contrário, não somos responsáveis ​​por reembolsos, danos ou compensações devido a alterações de modelos de terceiros, descontinuação de recursos, alterações de preços, restrições regionais, limites de tarifas ou alterações de serviço.

## 14. Propriedade intelectual, feedback e confidencialidade

O site, painel, software, APIs, documentação, marcas, marcas registradas, designs, sistemas de pedidos, sistemas de faturamento, sistemas de controle de risco e tecnologia relacionada são de propriedade da VOC AI ou de seus licenciadores. Exceto pelo direito limitado de usar os Serviços sob este Contrato, não transferimos quaisquer direitos de propriedade intelectual para você.

Se você nos fornecer sugestões, feedback, emitir relatórios ou ideias de melhoria, você nos concede o direito de usar, copiar, modificar, publicar e comercializar esse feedback sem pagamento a você.

Se qualquer uma das partes divulgar informações marcadas como confidenciais ou que devam ser razoavelmente entendidas como confidenciais por sua natureza, a parte receptora deverá protegê-las com cuidado razoável e usá-las apenas conforme necessário para executar este Contrato ou fornecer os Serviços. É permitida a divulgação exigida por lei, reguladores, tribunais, prestadores de serviços de pagamento, autoridades fiscais ou órgãos de tratamento de disputas.

## 15. Isenções de responsabilidade e limitação de responsabilidade

Os Serviços são fornecidos "como estão" e "conforme disponíveis". Na medida máxima permitida pela lei aplicável, não garantimos que os Serviços serão ininterruptos, livres de erros, livres de vulnerabilidades, livres de perdas ou adequados às suas necessidades comerciais, ou que qualquer modelo, API, preço, crédito, saída, latência, limite de taxa, disponibilidade regional, método de pagamento ou serviço de terceiros permanecerá disponível.

Em toda a extensão permitida pela lei aplicável, a VOC AI não é responsável por danos indiretos, incidentais, especiais, consequenciais, exemplares ou punitivos, lucros cessantes, perda de receita, perda de boa vontade, perda de dados, interrupção de negócios, custos de aquisição substitutos, Saídas AI, conduta de serviço de terceiros, conduta de pagamento de terceiros ou conduta de plataforma de terceiros.

Em toda a extensão permitida pela lei aplicável, a responsabilidade total da VOC AI decorrente dos Serviços, pedidos, saldo, entrega, uso, reembolsos ou este Contrato não excederá o maior valor que você realmente pagou pelos Serviços relevantes nos 3 meses anteriores à reclamação e não reembolsado, ou US$ 100. Esta limitação não se aplica à responsabilidade que não pode ser limitada por lei.

## 16. Indenização

Em toda a extensão permitida pela lei aplicável, você indenizará e isentará a VOC AI, suas afiliadas, prestadores de serviços e prestadores de serviços terceirizados de reivindicações, perdas, responsabilidades, penalidades, custos e despesas decorrentes da atividade de sua conta, Conteúdo do usuário, uso da chave API, integrações, uso ilegal, violação deste Contrato, violação de políticas de terceiros, fornecimento não autorizado a terceiros, violação, violações de privacidade, erros de informações fiscais, disputas de pagamento, estornos ou membros da equipe conduta.

## 17. Legislação Aplicável e Resolução de Disputas

Sem limitar qualquer proteção irrenunciável do consumidor, proteção de dados ou direitos legais locais obrigatórios, este Contrato é regido pelas leis do Estado da Califórnia, Estados Unidos, independentemente das regras de conflito de leis.

Para qualquer disputa relacionada a este Contrato ou aos Serviços, as partes tentarão primeiro, de boa fé, resolver a disputa entrando em contato com support@flatkey.ai. Se a disputa não for resolvida, exceto para questões de pequenas causas ou questões para as quais a arbitragem é proibida por lei, as partes concordam em submeter a disputa à arbitragem na Califórnia, perante um provedor de arbitragem competente, de acordo com suas regras. Você e VOC AI renunciam ao direito de resolver disputas por meio de ações coletivas, ações representativas ou julgamentos com júri, a menos que a lei aplicável não permita tal renúncia.

## 18. Alterações neste Contrato

Poderemos atualizar este Contrato de tempos em tempos. Alterações materiais podem ser notificadas através do site, painel, e-mail ou outros meios razoáveis. O Contrato atualizado geralmente se aplica a novos pedidos, novos usos e uso continuado dos Serviços após a atualização. Se você não concordar com a atualização, deverá parar de usar os Serviços e lidar com o saldo não utilizado ou o encerramento da conta de acordo com as políticas aplicáveis.

## 19. Contato

Para dúvidas sobre este Contrato, pedidos, cobrança, reembolsos, conformidade, avisos ou problemas de serviço, entre em contato com support@flatkey.ai ou escreva para VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, Estados Unidos.

Todos os conteúdos acima estarão sujeitos à versão em inglês.`,
  privacy: `# Política de Privacidade flatkey.ai

Última atualização: 4 de junho de 2026

Esta Política de Privacidade explica como VOC AI INC ("VOC AI", "nós", "nos" ou "nosso") coleta, usa, compartilha, retém e protege informações quando você acessa ou usa flatkey.ai, serviços flatkey.ai, sites relacionados, painéis, APIs, páginas de checkout, documentação e canais de suporte.

Entidade operacional: VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, Estados Unidos. Contato: support@flatkey.ai.

## 1. Escopo

Esta Política se aplica ao registro de conta, gerenciamento de organização, compras, recargas, entrega, acesso API, roteamento de modelo, registros de uso, cobrança, reembolsos, suporte, análise de segurança e serviços digitais relacionados que fornecemos. Serviços de modelo de terceiros, provedores de serviços de pagamento, carteiras, bancos, redes de cartões, serviços em nuvem, ferramentas analíticas ou outros sites processam informações de acordo com suas próprias políticas e termos de privacidade. Esta Política não substitui políticas de terceiros.

## 2. Informações que coletamos

Podemos coletar informações que você fornece diretamente, incluindo nome, endereço de e-mail, senha ou informações de autenticação, nome da empresa, função, membros da equipe, endereço de cobrança, informações comerciais, identificação fiscal, informações de IVA/GST, informações de fatura, informações de pedidos, mensagens de suporte, solicitações de reembolso, materiais de conformidade, configurações do painel e comunicações conosco.

Quando você usa os Serviços, podemos processar informações relacionadas à entrega e uso do serviço, incluindo número do pedido, ID de pagamento, status de entrega, saldo, registros de crédito, nome da chave API, ID da solicitação, carimbo de data e hora, seleção de serviço, seleção de modelo, entradas, saídas, arquivos, imagens, código, prompts, uso, valor de dedução, preço, latência, registros de erros, informações de roteamento e eventos de segurança.

Também podemos coletar automaticamente informações técnicas, incluindo endereço IP, identificadores de dispositivos, tipo de navegador, sistema operacional, localização inferida pela rede, páginas visitadas, URL de referência, eventos de sessão, registros de login, cliques e ações, registros de diagnóstico, registros de falhas, dados de desempenho, sinais antifraude e informações semelhantes.

Podemos receber informações relacionadas à sua conta, pedidos, pagamentos, permissões, uso, segurança ou assuntos de suporte de provedores de serviços de pagamento, provedores de autenticação, provedores antifraude, ferramentas de suporte, ferramentas analíticas, clientes corporativos, administradores de equipe ou provedores de serviços terceirizados.

## 3. Entradas, Saídas e Processamento de Modelo

As entradas que você envia e os resultados que você recebe podem passar por nossos sistemas conforme necessário para fornecer os Serviços e podem ser enviados ao serviço modelo ou serviço técnico relevante para concluir a solicitação. Diferentes modelos e serviços de terceiros podem ter diferentes regras de processamento de dados, registro, treinamento, retenção e segurança. Você deve revisar as regras aplicáveis ​​antes de usar um modelo específico e evitar enviar informações que não esteja autorizado a enviar ou informações confidenciais que não sejam necessárias.

A menos que o painel, a documentação ou a descrição do pedido forneçam expressamente um recurso relevante, não prometemos armazenar o histórico completo de entradas ou saídas. Para fins de solução de problemas, segurança, medição, reembolso, disputa ou conformidade, poderemos reter metadados de solicitação, registros de erros, registros de uso, registros necessários e materiais que você fornece voluntariamente em comunicações de suporte.

Podemos usar informações agregadas, anônimas ou desidentificadas para análise estatística, planejamento de capacidade, gerenciamento de custos, análise de modelo e qualidade de serviço, melhoria de produtos, modelagem de risco e operações comerciais. Essas informações não identificarão razoavelmente um indivíduo específico.

## 4. Cookies e tecnologias semelhantes

Usamos cookies, armazenamento local, pixels, logs e tecnologias semelhantes para mantê-lo conectado, proteger sessões, lembrar preferências, finalizar a compra, detectar fraudes e abusos, medir visitas, monitorar desempenho, solucionar problemas e melhorar os Serviços. Você pode controlar alguns cookies através das configurações do navegador, mas desabilitar cookies pode afetar o login, o painel, o checkout, a segurança, as estatísticas de uso ou a funcionalidade de suporte.

## 5. Informações sobre pagamento e pedido

Os pagamentos podem ser processados ​​por Paddle, Stripe, bancos, redes de cartões, carteiras, fornecedores locais de métodos de pagamento, fornecedores antifraude, fornecedores de impostos, fornecedores de faturas ou outros prestadores de serviços necessários. Podemos receber ou armazenar ID de pagamento, ID de checkout, número de pedido, status de pagamento, status de autorização, status de liquidação, produto, valor, moeda, valor de imposto, taxa de imposto, jurisdição fiscal, número de fatura, número de recibo, status de reembolso, status de estorno ou disputa, endereço de cobrança, país, nome comercial, ID fiscal, e-mail de cobrança e informações necessárias para processamento de suporte.

Não armazenamos intencionalmente números completos de cartão, códigos de verificação de cartão, credenciais de contas bancárias ou credenciais de carteira em nossos próprios sistemas. Os dados do método de pagamento são processados ​​pelo prestador de serviços de pagamento relevante de acordo com as suas regras de segurança, privacidade e conformidade da rede de pagamento. Podemos reter metadados de pagamento limitados, como nome do provedor de pagamento, tipo de método de pagamento, últimos quatro dígitos do cartão fornecidos pelo provedor, ID de pagamento, URL de recibo, URL de fatura, ID de reembolso e ID de disputa para cobrança, impostos, contabilidade, suporte, reembolso e tratamento de disputas.

## 6. Como usamos as informações

Usamos informações para criar e autenticar contas, processar pedidos e pagamentos, entregar créditos de serviço, manter registros de saldo e uso, fornecer acesso API, processar solicitações, calcular uso e taxas, lidar com faturas, recibos, reembolsos e disputas, enviar avisos de serviço, responder a solicitações de suporte, solucionar problemas, detectar e prevenir fraudes, abusos, incidentes de segurança e violações de políticas, fazer cumprir o Contrato do Usuário e regras de terceiros, cumprir obrigações fiscais, contábeis, de auditoria, legais e de conformidade e proteger os direitos e segurança da VOC AI, usuários, prestadores de serviços terceirizados, prestadores de serviços de pagamento e o público.

Se você optar por receber marketing, atualizações de produtos ou avisos de eventos, poderemos usar suas informações de contato para enviar essas comunicações. Você pode cancelar usando o método de cancelamento de inscrição no e-mail ou entrando em contato conosco. Avisos de serviço, avisos de segurança, avisos de cobrança e avisos legais não são afetados pelas desativações de marketing.

## 7. Tratamento cuidadoso das informações

Limitamos o acesso interno com base nas necessidades comerciais e nas responsabilidades do pessoal, e usamos gerenciamento de permissões, registro, criptografia razoável, monitoramento, backups e processos de auditoria para proteger informações de contas, pedidos, pagamentos, uso e suporte. Para reembolsos, estornos, chamadas anormais, incidentes de segurança ou análises de conformidade, poderemos manter registros mais detalhados e realizar análises adicionais.

Não solicitaremos nas comunicações de suporte que você forneça credenciais de pagamento completas, senhas, chaves API em texto simples ou outras credenciais confidenciais desnecessárias. Se a solução de problemas exigir capturas de tela ou registros, você deverá redigir informações confidenciais não relacionadas. Se os materiais contiverem informações confidenciais desnecessárias, poderemos solicitar que você envie uma versão editada.

Envidamos esforços razoáveis ​​para limitar o compartilhamento de informações ao que é relevante para a prestação dos Serviços, processamento de pagamentos, preenchimento de solicitações, solução de problemas, cálculo de contas, tratamento de reembolsos, resposta a disputas, cumprimento de requisitos legais ou proteção da segurança do serviço.

## 8. Como compartilhamos informações

Podemos compartilhar informações com provedores de serviços que nos ajudam a operar os Serviços, incluindo hospedagem, bancos de dados, cache, rede, registro, monitoramento, segurança, autenticação, e-mail, suporte ao cliente, análises, pagamento, impostos, faturas, recibos, antifraude, conformidade, auditoria e provedores de consultoria profissional.

Para concluir a entrega de serviços, solicitações API, chamadas de modelo ou processamento técnico, podemos enviar o Conteúdo do Usuário necessário, solicitar informações, identificadores de conta, informações de uso e metadados para serviços de modelo, plataformas API, provedores de nuvem, provedores de gateway ou outras plataformas de terceiros. Terceiros processam informações relacionadas de acordo com seus próprios termos, políticas de privacidade, regras de processamento de dados e políticas de uso.

Também poderemos divulgar informações quando exigido pela lei aplicável, intimações, ordens judiciais, solicitações governamentais, autoridades fiscais, regras de rede de pagamento, requisitos de auditoria ou requisitos regulamentares, ou para investigar fraudes, estornos, disputas de pagamento, abuso, incidentes de segurança, violações de políticas, infrações, risco de sanções ou para proteger direitos, propriedade, segurança e integridade do serviço.

Se estivermos envolvidos em uma fusão, aquisição, financiamento, reestruturação, venda de ativos, falência ou transação semelhante, as informações poderão ser divulgadas ou transferidas como parte dessa transação. O destinatário deve continuar a processar informações de acordo com a legislação aplicável e os princípios de proteção refletidos nesta Política.

## 9. Retenção

Retemos informações pelo tempo necessário para fornecer os Serviços, manter registros de contas e pedidos, fornecer créditos de serviços, calcular uso e cobrança, lidar com reembolsos e disputas, cumprir obrigações fiscais e contábeis, prevenir fraudes e abusos, apoiar a segurança, atender a requisitos de auditoria e conformidade e proteger direitos.

As informações da conta são geralmente retidas por um período razoável após o encerramento da conta. Os registros de pedidos, impostos, faturas, contabilidade e disputas podem ser retidos por mais tempo, conforme exigido por lei ou pelas regras da rede de pagamento. Logs de segurança, logs de diagnóstico e registros técnicos são retidos conforme necessário para operações, segurança e solução de problemas.

Os registros de solicitação, erro e uso API podem ter diferentes períodos de retenção dependendo do recurso, tipo de log, necessidade de segurança e requisitos de conformidade. Mantemos esses registros dentro do escopo necessário para fornecer os Serviços, solucionar problemas, calcular contas, lidar com reembolsos, responder a disputas, prevenir abusos e atender aos requisitos legais.

Quando as informações não são mais necessárias, excluímos, anonimizamos ou restringimos o processamento posterior de acordo com a legislação e os processos comerciais aplicáveis.

## 10. Transferências Internacionais

VOC AI está localizado nos Estados Unidos. Nós, nossos prestadores de serviços, prestadores de serviços de pagamento e prestadores de serviços terceirizados podemos processar informações nos Estados Unidos, Europa, Ásia ou outros países e regiões. As leis de proteção de dados nesses locais podem diferir das leis onde você está localizado. Usaremos salvaguardas de transferência transfronteiriças apropriadas quando exigido pela lei aplicável.

## 11. Segurança

Utilizamos medidas administrativas, técnicas e organizacionais, como controles de acesso, gerenciamento de permissões, logs, criptografia razoável, monitoramento, backups, auditorias e processos internos para proteger as informações. Nenhum sistema pode ser garantido como absolutamente seguro. Você também é responsável por proteger sua conta, senha, e-mail, dispositivos, chaves API, credenciais de acesso, conta de pagamento e credenciais de serviços relacionados.

Se você acredita que sua conta, chave API, método de pagamento ou dados foram acessados ​​ou usados ​​sem autorização, entre em contato conosco imediatamente.

## 12. Suas escolhas e direitos

Você pode atualizar algumas informações de conta, faturamento e equipe no painel. Dependendo da sua localização e da lei aplicável, você pode ter direitos para solicitar acesso, correção, exclusão, portabilidade, restrição, objeção, retirada de consentimento, cancelar o compartilhamento de determinados dados ou reclamar junto a um regulador.

Talvez seja necessário verificar sua identidade antes de processar uma solicitação. Também poderemos reter determinadas informações quando permitido ou exigido pela lei aplicável, como impostos, contabilidade, segurança, controle de risco, pagamento, disputa, auditoria, conformidade ou registros legais.

Não vendemos intencionalmente informações pessoais por dinheiro. Se a lei aplicável tratar determinada publicidade, análise ou compartilhamento de dados como uma “venda” ou “compartilhamento”, você poderá entrar em contato conosco para exercer quaisquer direitos de cancelamento aplicáveis.

## 13. Privacidade das Crianças

Os Serviços não são direcionados a crianças menores de 13 anos e não coletamos intencionalmente informações pessoais de crianças menores de 13 anos. Se você acredita que uma criança nos forneceu informações, entre em contato conosco para que possamos analisá-las e, quando apropriado, excluí-las.

## 14. Atualizações de políticas

Poderemos atualizar esta Política de Privacidade de tempos em tempos. Alterações materiais podem ser notificadas através do site, painel, e-mail ou outros meios razoáveis. A Política atualizada aplica-se às atividades de processamento de informações após a atualização.

## 15. Contato

Para questões de privacidade, solicitações de dados, relatórios de segurança ou dúvidas sobre proteção de dados, entre em contato com support@flatkey.ai ou escreva para VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, Estados Unidos.

Todos os conteúdos acima estarão sujeitos à versão em inglês.`,
  refund: `# Política de reembolso flatkey.ai

Última atualização: 4 de junho de 2026

Esta Política de Reembolso se aplica aos serviços flatkey.ai fornecidos por VOC AI INC ("VOC AI", "nós", "nos" ou "nosso") por meio de flatkey.ai, páginas de checkout, painel e canais de suporte, incluindo recargas de conta, saldo de conta pré-paga, créditos de serviço, uso de API, entrega de serviço digital e assuntos de suporte relacionados.

Entidade operacional: VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, Estados Unidos. Contato: support@flatkey.ai.

## 1. Princípios Básicos

flatkey.ai fornece serviços digitais. O saldo da conta, os créditos de serviço e os serviços digitais relacionados geralmente são entregues eletronicamente imediatamente após o pagamento bem-sucedido ou a aprovação do pedido e podem ser usados ​​imediatamente para solicitações API, chamadas de modelo, processamento de arquivos, processamento de imagens, processamento de solicitações ou outros recursos pagos. Assim que a entrega e o uso ocorrerem, poderão ser incorridos custos de modelo de terceiros, serviço de nuvem, pagamento, impostos, rede e infraestrutura.

Nossos princípios de reembolso são: não entrega, cobranças duplicadas, erros de sistema verificáveis ​​e requisitos legais obrigatórios recebem revisão prioritária; créditos entregues e usados, saldo consumido, solicitações concluídas e serviços digitais fornecidos com sucesso geralmente não são reembolsáveis.

Esta Política não limita quaisquer direitos irrenunciáveis ​​de reembolso, cancelamento, retirada, conteúdo digital, serviço digital ou disputa de pagamento do consumidor previstos pela lei aplicável.

## 2. Janela de reembolso para saldo não utilizado

O saldo da conta ou os créditos de serviço não utilizados podem ser enviados para análise de reembolso dentro de 24 horas após a conclusão da compra. Após 24 horas, o saldo não utilizado geralmente não é elegível para reembolso em dinheiro, a menos que a lei aplicável exija o contrário, as regras do provedor de serviços de pagamento exijam o contrário ou confirmemos cobranças duplicadas, não entrega, erro de sistema verificável ou erro de imposto ou fatura.

Se uma página de compra, descrição de pedido, contrato empresarial ou lei aplicável fornecer um período de reembolso mais longo, a regra mais específica será aplicada. Créditos promocionais, de recompensa, de avaliação, de cupom, de presente, de saldo gratuito ou gratuitos geralmente não são elegíveis para reembolso em dinheiro.

## 3. Reembolsos ou ajustes que podemos analisar

Você pode solicitar reembolso, restauração de saldo, correção de crédito ou ajuste de conta nas seguintes situações:

- o mesmo pedido foi cobrado mais de uma vez;
- o pagamento foi bem-sucedido, mas o saldo da conta, os créditos de serviço ou os serviços digitais não foram entregues;
- o pagamento falhou, foi revertido ou cancelado, mas a forma de pagamento ainda mostra uma cobrança;
- nosso erro de sistema verificável causou dedução duplicada, dedução incorreta, medição incorreta ou entrega de crédito incorreta;
- você solicitar dentro de 24 horas após a compra e o saldo ou créditos relacionados não tiverem sido usados, transferidos, abusados ​​ou associados a atividades suspeitas;
- o processamento de imposto, fatura, recibo, moeda, valor do pedido ou método de pagamento precisa de correção;
- a lei aplicável, as regras dos prestadores de serviços de pagamento, as regras dos serviços digitais, as regras fiscais ou as regras da rede de pagamento exigem um reembolso;
- VOC AI, Paddle, Stripe ou outro provedor de serviços de pagamento de pedido original determina, após análise, que um reembolso ou ajuste é apropriado.

O método de aprovação e processamento depende do status do pedido, dos registros de entrega, dos registros de uso, do status do pagamento, dos requisitos fiscais e de fatura, dos resultados da análise de risco, das regras do provedor de serviços de pagamento e da legislação aplicável.

## 4. Processo de revisão

Analisamos solicitações de reembolso ou ajuste usando registros de pedidos, registros de prestadores de serviços de pagamento, registros de entrega, registros de saldo, registros de uso, IDs de solicitação, registros de erros, comunicações de suporte, registros fiscais e registros de faturas. Para disputas de uso, nos concentramos em saber se as solicitações realmente ocorreram, se o saldo foi deduzido, se ocorreu dedução duplicada, se houve um erro no sistema e se as solicitações relevantes vieram de sua conta, chave API, membros da equipe, aplicativo ou integração.

Durante a análise, poderemos solicitar que você forneça o e-mail da conta, número do pedido, ID de pagamento, recibo, fatura, ID da solicitação, carimbo de data/hora, captura de tela, mensagem de erro ou outras informações razoavelmente necessárias. Solicitações que não consigam verificar o pedido, a titularidade da conta, o status da entrega, o status de uso ou o status do pagamento não poderão ser aprovadas.

Se descobrirmos que o pedido ou uso relacionado envolve revenda não autorizada, retransmissão, compartilhamento de conta, ocultação do usuário verdadeiro, criação de conta em massa, chamadas concentradas anormais, fraude, abuso, risco de sanções, abuso de estorno ou limitação de evasão, poderemos pausar a revisão, negar reembolsos, limitar a restauração de saldo ou tomar medidas de restrição de conta de acordo com o Contrato do Usuário.

Se o mesmo pedido tiver entrado em um processo de estorno, disputa de pagamento, reversão de pagamento ou investigação do provedor de serviços de pagamento, geralmente trataremos do assunto por meio do provedor de serviços de pagamento relevante ou do processo de rede do cartão e não emitiremos separadamente um reembolso independente em dinheiro ao mesmo tempo, para evitar reembolsos duplicados ou conflitos contábeis. Após o término do processo de contestação, caso ainda sejam necessárias correções de saldo da conta ou de faturamento, iremos tratá-las com base no resultado final e nos registros do sistema.

## 5. Itens geralmente não reembolsáveis

Exceto quando a lei aplicável exigir o contrário, os seguintes itens geralmente não são reembolsáveis:

- saldo ou créditos de serviço usados ​​para solicitações API, chamadas de modelo, processamento de arquivos, processamento de imagens, uso de cache, processamento de solicitações ou outros recursos pagos;
- serviços digitais que foram entregues e iniciados com sucesso;
- taxas causadas por contas, membros da equipe, chaves API, scripts automatizados, integrações, chaves vazadas, configurações de permissão, pessoal interno ou usuários autorizados;
- custos de modelos de terceiros, custos de serviços em nuvem, cobranças mínimas, uso excessivo, impostos, diferenças de conversão de moeda, taxas bancárias, taxas de rede de cartão, taxas de rede, taxas de provedores de serviços de pagamento ou taxas de plataforma de terceiros;
- promocionais, de recompensa, de avaliação, de cupom, de presente, de saldo gratuito ou de créditos gratuitos;
- pedidos, saldo ou créditos de serviço associados a fraude, abuso, risco de sanções, uso ilegal, violações de políticas, compartilhamento de conta, revenda não autorizada, retransmissão, fornecimento a terceiros, abuso de estorno ou evasão de limites;
- solicitações baseadas em insatisfação com AI Qualidade de saída, comportamento do modelo, disponibilidade de serviço, latência, limites de taxas, alterações de preços, restrições regionais ou alterações de políticas de terceiros, onde o serviço foi entregue conforme descrito ou os créditos relevantes foram usados;
- problemas causados ​​por informações imprecisas de conta, e-mail, cobrança, impostos, negócios, fatura ou pagamento que você forneceu, a menos que a lei aplicável ou as regras do provedor de serviços de pagamento exijam correção ou reembolso.

## 6. Conteúdo Digital e Direitos do Consumidor

Para conteúdo digital ou serviços digitais que são entregues e utilizáveis ​​imediatamente, na medida permitida pela lei aplicável, você poderá perder os direitos legais de cancelamento ou retirada assim que o saldo da conta, os créditos de serviço ou os serviços relacionados forem entregues ou quando você começar a usar os serviços relevantes.

Se a sua localização fornecer direitos irrenunciáveis ​​de proteção ao consumidor, reembolso, retirada, cancelamento ou disputa, lidaremos com as solicitações de acordo com a lei aplicável, mesmo que outras partes desta Política indiquem o contrário.

## 7. Como solicitar um reembolso

Entre em contato com support@flatkey.ai e forneça o máximo possível das seguintes informações:

- e-mail da conta;
- número do pedido, ID de pagamento, número do recibo Paddle, número do recibo Stripe, referência de pagamento ou número da fatura;
- data de compra, valor, moeda e tipo de método de pagamento;
- motivo da solicitação de reembolso ou reajuste;
- capturas de tela relevantes, mensagens de erro, status de entrega, registros de saldo ou registros de painel;
- para problemas de uso, nome da chave API, ID da solicitação, carimbo de data/hora, modelo ou nome do serviço.

Cobranças duplicadas, não entrega, dedução incorreta, erros de fatura, problemas fiscais ou anormalidades no pagamento devem ser enviadas assim que descobertas. Poderemos solicitar informações adicionais para verificar a propriedade da conta, registros de compra, status de entrega, status de uso, status de pagamento, informações fiscais e elegibilidade para reembolso.

## 8. Método de reembolso e tempo de processamento

Os reembolsos em dinheiro aprovados geralmente retornam ao método de pagamento original. O tempo de processamento depende de Paddle, Stripe, bancos, redes de cartões, carteiras, provedores locais de métodos de pagamento e outros provedores de serviços relevantes. Não podemos garantir quando um terceiro concluirá a postagem.

Em alguns casos, podemos resolver um problema através de restauração de saldo, correção de crédito, ajuste de conta, nota de crédito, correção de fatura ou atualização de recibo, especialmente quando o problema diz respeito a falha na entrega, medição incorreta, dedução duplicada ou erro de registro de conta.

Impostos, faturas, notas de crédito, recibos, conversão de moeda e limitações de métodos de pagamento podem ser tratados pelo provedor de serviços de pagamento do pedido original. Se um pedido tiver entrado no status de estorno, disputa, controle de risco, revisão fiscal ou restrição do provedor de serviços de pagamento, os reembolsos poderão demorar mais ou deverão seguir o processo relevante.

## 9. Paddle, Stripe e outros provedores de serviços de pagamento

Se um pedido for processado por Paddle como Comerciante Registrado ou vendedor, Paddle poderá determinar ou executar reembolsos, impostos, faturas, notas de crédito, recibos e questões de disputa de pagamento de acordo com seu processo.

Se um pedido for processado pela Stripe ou outro processador de pagamento, a VOC AI poderá revisar a solicitação de reembolso e, quando viável, instruir o processador a devolver o reembolso aprovado ao método de pagamento original. As regras e os prazos de processamento podem variar de acordo com o provedor de serviços de pagamento, país, moeda, método de pagamento e banco.

## 10. Estornos e disputas de pagamento

Se você iniciar um estorno, disputa de pagamento, reversão de pagamento ou processo semelhante, poderemos suspender contas relacionadas, chaves API, saldo, créditos de serviço, pedidos ou acesso ao serviço durante a investigação.

Podemos fornecer à Paddle, Stripe, bancos, redes de cartões, carteiras, redes de pagamento, prestadores de serviços fiscais ou órgãos de tratamento de disputas registros de pedidos, registros de entrega, registros de uso, registros de saldo, registros fiscais, faturas, recibos, registros de reembolso, comunicações de suporte, atividade de conta e registros de segurança para investigar e responder a disputas.

Entre em contato conosco primeiro para cobranças duplicadas, não entrega, deduções incorretas, questões fiscais, faturas, recibos e problemas de cobrança. Iniciar diretamente um estorno pode resultar na suspensão da conta, atrasos no reembolso, taxas de disputa ou restrições de compras futuras.

Se você já entrou em contato com um banco, rede de cartões, provedor de carteira ou provedor de serviços de pagamento para iniciar uma disputa, informe-nos o status da disputa e o número de referência nas comunicações de reembolso. Ocultar uma disputa ativa, solicitar reembolsos duplicados ao mesmo tempo ou continuar um estorno após receber um reembolso pode ser tratado como abuso de estorno.

## 11. Atualizações de políticas

Poderemos atualizar esta Política de Reembolso de tempos em tempos. A Política atualizada geralmente se aplica a compras, entregas, uso e solicitações de reembolso que ocorrem após a atualização, a menos que a lei aplicável ou as regras do provedor de serviços de pagamento exijam o contrário.

## 12. Contato

Para perguntas sobre compras, entrega, saldo da conta, créditos de serviço, cobranças duplicadas, deduções incorretas, impostos, faturas, recibos, elegibilidade para reembolso, recibos Paddle, recibos Stripe ou disputas de pagamento, entre em contato com support@flatkey.ai ou escreva para VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, Estados Unidos.

Todos os conteúdos acima estarão sujeitos à versão em inglês.`,
  sla: `# Acordo de Nível de Serviço flatkey.ai

Última atualização: 13 de junho de 2026

Este Acordo de Nível de Serviço ("SLA") descreve a meta de disponibilidade e o processo de suporte dos serviços flatkey.ai fornecidos pela VOC AI INC ("VOC AI", "nós" ou "nosso").

## 1. Escopo

Este SLA se aplica ao painel hospedado, gateway de API, roteamento, medição e serviços de conta flatkey.ai que operamos diretamente. Ele não se aplica a provedores terceiros de modelos de IA, provedores de pagamento, redes de clientes, aplicações de clientes, recursos beta, eventos de força maior, manutenção programada, mitigação de abuso, suspensão de conta ou problemas causados por configuração, credenciais, integrações ou violações de política do cliente.

## 2. Meta de disponibilidade

Temos como meta 99,5% de disponibilidade mensal para os endpoints cobertos do serviço flatkey.ai. A disponibilidade é medida pelos nossos sistemas de monitoramento de produção para os serviços cobertos.

## 3. Manutenção e mudanças de serviço

Podemos realizar manutenção programada ou emergencial para melhorar segurança, confiabilidade, desempenho ou conformidade. Empregamos esforços razoáveis para reduzir o impacto ao cliente e, quando prático, fornecer aviso pelo painel, site, e-mail ou canais de suporte.

## 4. Dependências de terceiros

flatkey.ai roteia solicitações para provedores terceiros de modelos e depende de provedores de nuvem, rede, pagamento, segurança e análise. Interrupções, limites de taxa, alterações de política, restrições regionais, comportamento de modelo ou falhas do lado de provedores terceiros estão fora deste SLA.

## 5. Suporte

Para problemas de disponibilidade do serviço, entre em contato com support@flatkey.ai com o e-mail da conta, endpoint afetado, IDs de solicitação se disponíveis, carimbos de data/hora, mensagens de erro e resumo do impacto. Analisamos solicitações de suporte com base na gravidade, registros disponíveis e risco operacional.

## 6. Remédios

A menos que um acordo escrito separado preveja remédio diferente, este SLA não cria créditos de serviço, reembolsos, penalidades ou indenizações prefixadas automáticas. Qualquer ajuste de boa-fé, correção de saldo ou remediação de suporte é tratado caso a caso conforme o Contrato do Usuário e as políticas aplicáveis.

## 7. Atualizações

Podemos atualizar este SLA de tempos em tempos. O SLA atualizado geralmente se aplica a períodos de serviço após a atualização.

## 8. Contato

Para perguntas sobre este SLA ou um incidente de serviço, entre em contato com support@flatkey.ai ou escreva para VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, Estados Unidos.

Todos os conteúdos acima estarão sujeitos à versão em inglês.`,
}
