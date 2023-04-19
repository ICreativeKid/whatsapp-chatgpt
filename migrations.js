const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('E:/whatsapp-chatgpt/configs.db');

db.run("UPDATE user_configs SET isFirstTime = 1", function(err) {
  if (err) {
    console.log('Error:', err.message);
  } else {
    console.log('Column added successfully!');
  }

  db.close();
});

// node migrations.js


// ALTER TABLE user_configs ADD COLUMN <nome da coluna> <tipo TEXT> DEFAULT <valor 'algolia'> - adicionar coluna
// UPDATE user_configs SET <nome coluna isFirstTime> = <valor 1> - atualizar todos os valores de uma coluna