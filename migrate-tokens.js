// Script de migração para importar tokens antigos para o banco de dados
// Execute este arquivo APÓS criar sua conta de administrador no painel

const { licenses } = require('./database');

// Cole aqui seus tokens antigos do sistema anterior
const TOKENS_ANTIGOS = [
  { token: 'SWAIROVSK-KAKCHATOKEN87487874', name: 'Cliente Swarovski' },
  { token: 'ZECA-202549988HATOKEN87487874', name: 'Cliente Zeca' },
  // Adicione mais tokens aqui no formato acima
];

console.log('🔄 Iniciando migração de tokens...\n');

let sucesso = 0;
let falhas = 0;

TOKENS_ANTIGOS.forEach(({ token, name }) => {
  try {
    licenses.create(token, name);
    console.log(`✅ Token migrado: ${name} (${token})`);
    sucesso++;
  } catch (error) {
    console.log(`❌ Erro ao migrar: ${name} - ${error.message}`);
    falhas++;
  }
});

console.log(`\n📊 Resultado da migração:`);
console.log(`   ✓ Sucessos: ${sucesso}`);
console.log(`   ✗ Falhas: ${falhas}`);
console.log(`\n✨ Migração concluída! Acesse o painel admin para gerenciar suas licenças.`);
