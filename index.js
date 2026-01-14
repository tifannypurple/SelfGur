const path = require('path');
const express = require('express');
const uuid = require('uuid');
const WebSocket = require('ws');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const { licenses, uploads, adminUsers } = require('./database');

// Garantir que a pasta static existe
const staticDir = path.resolve(__dirname, 'static');
if (!fs.existsSync(staticDir)) {
  fs.mkdirSync(staticDir, { recursive: true });
  console.log('✓ Pasta static criada com sucesso');
}

const app = express();

app.use(express.json());
app.use(require('express-fileupload')());

// Configurar sessão para o painel admin
app.use(session({
  secret: 'selfgur-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

// Middleware para verificar autenticação admin
const requireAuth = (req, res, next) => {
  if (req.session && req.session.adminId) {
    return next();
  }
  res.status(401).send({ message: 'Não autorizado' });
};

// Servir arquivos estáticos (sem listagem de diretórios)
app.use('/static', express.static(path.resolve(__dirname, 'static'), {
  index: false,
  dotfiles: 'deny'
}));

// Upload agora usa o banco de dados para validar tokens
app.post('/upload/:token', (req, res) => {
  const token = req.params.token;
  
  // Verificar se o token existe e está ativo
  const license = licenses.findByToken(token);
  
  if (!license) {
    return res.status(403).send({ message: 'Token de upload inválido.' });
  }
  
  if (!license.active) {
    return res.status(403).send({ message: 'Licença suspensa. Entre em contato com o administrador.' });
  }

  // Criar pasta específica para este cliente (baseada no ID da licença)
  const clientFolder = `cliente_${license.id}_${license.token.substring(0, 15)}`;
  const clientPath = path.resolve(__dirname, 'static', clientFolder);
  
  if (!fs.existsSync(clientPath)) {
    fs.mkdirSync(clientPath, { recursive: true });
  }

  const { image, audio } = req.files || {};
  const now = new Date();
  const datetime = now.toLocaleString('pt-BR', { hour12: false });
  
  if (image) {
    const filename = uuid.v4() + '.jpg';
    const fileSize = image.size;
    const relativePath = `${clientFolder}/${filename}`;
    
    image.mv(path.resolve(__dirname, 'static', relativePath)).then(() => {
      const url = `https://${req.headers.host}/static/${relativePath}`;
      
      // Registrar upload no banco de dados
      uploads.create(license.id, relativePath, image.name, 'image', fileSize, url);
      
      console.log(`[${datetime}] Token: ${token} | Licença: ${license.name} | Pasta: ${clientFolder} | url = ${url}`);
      res.send({ url });
    }).catch(err => res.status(500).send({ message: err.message }));

  } else if (audio) {
    if (!audio.mimetype.includes('webm')) {
      return res.status(400).send({ message: 'Audio mimetype must be webm' });
    }

    const filename = uuid.v4() + '.webm';
    const fileSize = audio.size;
    const relativePath = `${clientFolder}/${filename}`;
    
    audio.mv(path.resolve(__dirname, 'static', relativePath)).then(() => {
      const url = `https://${req.headers.host}/static/${relativePath}`;
      
      // Registrar upload no banco de dados
      uploads.create(license.id, relativePath, audio.name, 'audio', fileSize, url);
      
      console.log(`[${datetime}] Token: ${token} | Licença: ${license.name} | Pasta: ${clientFolder} | url = ${url}`);
      res.send({ url });
    }).catch(err => res.status(500).send({ message: err.message }));
    
  } else {
    res.status(400).send({ message: 'Missing image/audio field' });
  }
});

// ==================== ROTAS ADMINISTRATIVAS ====================

// Login do admin
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).send({ message: 'Username e password são obrigatórios' });
  }
  
  const admin = adminUsers.findByUsername(username);
  
  if (!admin) {
    return res.status(401).send({ message: 'Credenciais inválidas' });
  }
  
  const validPassword = await bcrypt.compare(password, admin.password);
  
  if (!validPassword) {
    return res.status(401).send({ message: 'Credenciais inválidas' });
  }
  
  req.session.adminId = admin.id;
  req.session.username = admin.username;
  
  res.send({ message: 'Login realizado com sucesso', username: admin.username });
});

// Logout do admin
app.post('/admin/logout', (req, res) => {
  req.session.destroy();
  res.send({ message: 'Logout realizado com sucesso' });
});

// Verificar se está autenticado
app.get('/admin/check', (req, res) => {
  if (req.session && req.session.adminId) {
    res.send({ authenticated: true, username: req.session.username });
  } else {
    res.send({ authenticated: false });
  }
});

// Criar usuário admin (apenas se não houver nenhum)
app.post('/admin/setup', async (req, res) => {
  const { username, password } = req.body;
  
  if (adminUsers.exists()) {
    return res.status(403).send({ message: 'Já existe um usuário admin' });
  }
  
  if (!username || !password) {
    return res.status(400).send({ message: 'Username e password são obrigatórios' });
  }
  
  const hashedPassword = await bcrypt.hash(password, 10);
  adminUsers.create(username, hashedPassword);
  
  res.send({ message: 'Usuário admin criado com sucesso' });
});

// Mudar senha do admin
app.post('/admin/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).send({ message: 'Senha atual e nova senha são obrigatórias' });
  }
  
  const admin = adminUsers.findByUsername(req.session.username);
  
  if (!admin) {
    return res.status(404).send({ message: 'Usuário não encontrado' });
  }
  
  const validPassword = await bcrypt.compare(currentPassword, admin.password);
  
  if (!validPassword) {
    return res.status(401).send({ message: 'Senha atual incorreta' });
  }
  
  const hashedNewPassword = await bcrypt.hash(newPassword, 10);
  const { db } = require('./database');
  const stmt = db.prepare('UPDATE admin_users SET password = ? WHERE id = ?');
  stmt.run(hashedNewPassword, admin.id);
  
  res.send({ message: 'Senha alterada com sucesso' });
});

// ==================== LICENÇAS ====================

// Criar nova licença
app.post('/admin/licenses', requireAuth, (req, res) => {
  const { token, name } = req.body;
  
  if (!token || !name) {
    return res.status(400).send({ message: 'Token e nome são obrigatórios' });
  }
  
  try {
    licenses.create(token, name);
    res.send({ message: 'Licença criada com sucesso' });
  } catch (err) {
    res.status(400).send({ message: 'Token já existe ou erro ao criar licença' });
  }
});

// Listar todas as licenças
app.get('/admin/licenses', requireAuth, (req, res) => {
  const allLicenses = licenses.getAll();
  
  // Adicionar estatísticas para cada licença
  const licensesWithStats = allLicenses.map(license => {
    const stats = licenses.getStats(license.id);
    return { ...license, ...stats };
  });
  
  res.send(licensesWithStats);
});

// Atualizar licença (nome ou status)
app.put('/admin/licenses/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { name, active } = req.body;
  
  licenses.update(id, { name, active });
  res.send({ message: 'Licença atualizada com sucesso' });
});

// Deletar licença
app.delete('/admin/licenses/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  
  // Obter informações da licença
  const allLicenses = licenses.getAll();
  const license = allLicenses.find(l => l.id == id);
  
  if (license) {
    // Deletar pasta completa do cliente
    const clientFolder = `cliente_${license.id}_${license.token.substring(0, 15)}`;
    const clientPath = path.resolve(__dirname, 'static', clientFolder);
    
    if (fs.existsSync(clientPath)) {
      // Deletar todos os arquivos dentro da pasta
      const files = fs.readdirSync(clientPath);
      files.forEach(file => {
        fs.unlinkSync(path.join(clientPath, file));
      });
      // Deletar a pasta
      fs.rmdirSync(clientPath);
    }
  }
  
  // Deletar uploads do banco
  uploads.deleteByLicense(id);
  
  // Deletar licença
  licenses.delete(id);
  
  res.send({ message: 'Licença e arquivos deletados com sucesso' });
});

// ==================== UPLOADS ====================

// Listar todos os uploads
app.get('/admin/uploads', requireAuth, (req, res) => {
  const allUploads = uploads.getAll();
  res.send(allUploads);
});

// Listar uploads de uma licença específica
app.get('/admin/uploads/license/:licenseId', requireAuth, (req, res) => {
  const { licenseId } = req.params;
  const licenseUploads = uploads.getByLicense(licenseId);
  res.send(licenseUploads);
});

// Deletar um upload específico
app.delete('/admin/uploads/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  
  const upload = uploads.findById(id);
  
  if (!upload) {
    return res.status(404).send({ message: 'Upload não encontrado' });
  }
  
  // Deletar arquivo físico
  const filePath = path.resolve(__dirname, 'static', upload.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  // Deletar do banco
  uploads.delete(id);
  
  res.send({ message: 'Upload deletado com sucesso' });
});

// Deletar todos os uploads de uma licença
app.delete('/admin/uploads/license/:licenseId', requireAuth, (req, res) => {
  const { licenseId } = req.params;
  
  // Deletar arquivos físicos
  const licenseUploads = uploads.getByLicense(licenseId);
  licenseUploads.forEach(upload => {
    const filePath = path.resolve(__dirname, 'static', upload.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
  
  // Deletar do banco
  uploads.deleteByLicense(licenseId);
  
  res.send({ message: 'Todos os uploads da licença foram deletados' });
});

const server = app.listen(25556, () => {
  console.log('Listening at port 25556');
  console.log('Done!');
});

const RTC = new WebSocket.Server({ server });

/** @type {Map<string, Set<WebSocket>>} */
const rooms = new Map();

function id() {
  return ++id.last;
}
id.last = 0;

RTC.on('connection', (socket, request) => {
  let room = request.url && request.url.substr(1);
  if (room) {
    if (rooms.has(room)) {
      rooms.get(room).add(socket);
    } else {
      rooms.set(room, new Set([socket]));
    }
  } else {
    return socket.close();
  }

  socket.id = id();

  console.log(`WebSocket ${socket.id} connected on room: ${room}`);

  socket.on('message', data => {
    if (rooms.has(room)) {
      rooms.get(room).forEach(peer => {
        peer != socket && peer.send(data);
      });
    }
  });
  socket.on('close', () => {
    const leaveFrom = rooms.get(room);
    if (leaveFrom) {
      leaveFrom.delete(socket);
      if (!leaveFrom.size)
        rooms.delete(room);
      
      console.log(`WebSocket ${socket.id} disconnected from room: ${room}`);
    } else {
      console.log(`WebSocket ${socket.id} disconnected`);
    }
  });
});

app.get('/admin', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'admin.html'));
});

// Redirect para https://nk1.gg em qualquer rota não definida
app.get('*', (req, res) => {
    // Permitir acesso direto a arquivos em /static
    if (req.path.startsWith('/static/')) {
        return res.status(404).send('Arquivo não encontrado');
    }
    // Redirecionar tudo mais para nk1.gg
    res.redirect('https://nk1.gg');
});