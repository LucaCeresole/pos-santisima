const express = require("express");
const { Sequelize, DataTypes } = require("sequelize");
const path = require("path"); // Módulo para trabajar con rutas de archivos
const bcrypt = require("bcryptjs"); // <- Nuevo
const jwt = require("jsonwebtoken"); // <- Nuevo
const cors = require("cors"); // <- Nuevo
require("dotenv").config();

const app = express();
const PORT = 3001; // Puerto en el que se ejecutará nuestro servidor backend

// Configuración de CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL, // Permite solicitudes solo desde la URL de tu frontend
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true, // Permite el envío de cookies o encabezados de autorización
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));

// Middleware para parsear el cuerpo de las solicitudes JSON
app.use(express.json());

// --- Configuración de Sequelize con SQLite ---
// La base de datos 'database.sqlite' se creará en la misma carpeta del backend.
const sequelize = new Sequelize({
  dialect: "sqlite", // Indica que usaremos SQLite
  storage: path.join(__dirname, "database.sqlite"), // Ruta del archivo de la base de datos
  logging: false, // Opcional: Desactiva los logs SQL en la consola para una salida más limpia
});

// --- DEFINICIÓN DE MODELOS DE LA BASE DE DATOS ---
// Estos modelos representan las tablas en nuestra base de datos.

// 2.3. Definición del modelo `Categoria`
// Esta tabla almacenará las categorías de nuestros productos (Pizzas, Toppings, Bebidas, etc.)
const Categoria = sequelize.define(
  "Categoria",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true, // Campo ID autoincremental y clave primaria
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false, // El nombre no puede ser nulo
      unique: true, // El nombre de la categoría debe ser único
    },
  },
  {
    tableName: "categorias", // Nombre de la tabla en la base de datos
    timestamps: false, // No queremos que Sequelize añada automáticamente 'createdAt' y 'updatedAt'
  }
);

// 2.4. Definición del modelo `Producto`
// Esta tabla almacenará la información detallada de cada producto (pizzas, toppings, etc.)
const Producto = sequelize.define(
  "Producto",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    descripcion: {
      type: DataTypes.STRING,
      allowNull: true, // La descripción es opcional
    },
    precio_venta: {
      type: DataTypes.FLOAT,
      allowNull: false, // El precio de venta es obligatorio
    },
    costo_compra: {
      type: DataTypes.FLOAT,
      allowNull: true, // El costo de compra es opcional
    },
    stock: {
      type: DataTypes.INTEGER,
      defaultValue: 0, // El stock por defecto es 0
    },
    // 'categoria_id' será una clave foránea que enlazará a la tabla `categorias`
  },
  {
    tableName: "productos",
    timestamps: false,
  }
);

// Definir la relación entre Producto y Categoria
// Un `Producto` pertenece a una `Categoria` (relación de muchos a uno)
Producto.belongsTo(Categoria, {
  foreignKey: "categoria_id", // Nombre de la columna que será la clave foránea en la tabla 'productos'
  targetKey: "id", // La clave primaria en la tabla 'categorias' a la que apunta
});
// Una `Categoria` tiene muchos `Productos` (relación de uno a muchos)
Categoria.hasMany(Producto, {
  foreignKey: "categoria_id",
});

// 2.5. Definición del modelo `Cliente`
// Esta tabla almacenará la información de nuestros clientes para historial y análisis.
const Cliente = sequelize.define(
  "Cliente",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    apellido: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // El teléfono debe ser único para identificar al cliente
    },
    direccion: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true, // El email también debe ser único si se proporciona
    },
    fecha_registro: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW, // Fecha y hora de creación del cliente
    },
    ultima_compra: {
      type: DataTypes.DATE,
      allowNull: true, // Última fecha en que el cliente hizo un pedido
    },
    ticket_promedio: {
      type: DataTypes.FLOAT,
      defaultValue: 0.0, // Ticket promedio de las compras del cliente
    },
    // `productos_favoritos` se almacenará como un JSON string en SQLite
    // Sequelize nos permite definir "getters" y "setters" para manejarlo como array/objeto JS.
    productos_favoritos: {
      type: DataTypes.TEXT, // SQLite no tiene un tipo de dato JSON nativo, usamos TEXT
      allowNull: true,
      get() {
        const rawValue = this.getDataValue("productos_favoritos");
        return rawValue ? JSON.parse(rawValue) : []; // Cuando se lee, se parsea a JS
      },
      set(value) {
        this.setDataValue("productos_favoritos", JSON.stringify(value)); // Cuando se guarda, se convierte a string JSON
      },
    },
  },
  {
    tableName: "clientes",
    timestamps: false,
  }
);

// 2.6. Definición del modelo `Usuario`
// Esta tabla gestionará los usuarios que pueden acceder al POS (administradores, vendedores).
// NOTA: La contraseña no se almacena directamente. Almacenaremos un HASH de la contraseña.
// La implementación del hashing (con bcrypt) la haremos en el Capítulo 4.
const Usuario = sequelize.define(
  "Usuario",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nombre_usuario: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // El nombre de usuario debe ser único
    },
    password_hash: {
      // Campo para almacenar el hash de la contraseña
      type: DataTypes.STRING,
      allowNull: false,
    },
    rol: {
      // Define el rol del usuario (ej. 'admin', 'vendedor')
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "vendedor", // Rol por defecto
    },
  },
  {
    tableName: "usuarios",
    timestamps: false,
  }
);

// --- FIN DEFINICIÓN DE MODELOS ---

// Función asíncrona para conectar a la base de datos y sincronizar los modelos
async function connectDB() {
  try {
    await sequelize.authenticate(); // Intenta conectar y autenticar con la DB
    console.log("Conexión a la base de datos establecida correctamente.");

    // Sincroniza todos los modelos con la base de datos.
    // `force: true` : Borra y recrea las tablas cada vez que se ejecuta. ¡ÚSALO CON EXTREMA PRECAUCIÓN!
    //   Es útil en desarrollo para aplicar rápidamente cambios en el esquema.
    //   NUNCA usar en producción con datos reales, ya que borraría todos los datos.
    //   Una vez que el esquema esté estable y tengas datos, cámbialo a `force: false`.
    await sequelize.sync({ force: true });
    console.log(
      "Modelos sincronizados con la base de datos (tablas creadas/actualizadas)."
    );

    // 2.8. Llamada a la función para insertar datos de prueba
    await insertTestData();
  } catch (error) {
    console.error("Error al conectar o sincronizar la base de datos:", error);
    process.exit(1); // Sale de la aplicación si hay un error crítico en la conexión/sincronización
  }
}

// 2.8. Función para insertar datos de prueba en las tablas
async function insertTestData() {
  // Verificar y cargar categorías si la tabla está vacía
  const categoriasCount = await Categoria.count();
  if (categoriasCount === 0) {
    await Categoria.bulkCreate([
      { nombre: "Pizzas Clásicas" },
      { nombre: "Pizzas Especiales" },
      { nombre: "Toppings" },
      { nombre: "Bebidas" },
      { nombre: "Empanadas" },
      { nombre: "Postres" },
    ]);
    console.log("Categorías de prueba insertadas.");
  }

  // Verificar y cargar productos si la tabla está vacía
  const productosCount = await Producto.count();
  if (productosCount === 0) {
    // Buscamos las IDs de las categorías recién creadas para asignarlas a los productos
    const pizzaClasicaCat = await Categoria.findOne({
      where: { nombre: "Pizzas Clásicas" },
    });
    const pizzaEspecialCat = await Categoria.findOne({
      where: { nombre: "Pizzas Especiales" },
    });
    const toppingsCat = await Categoria.findOne({
      where: { nombre: "Toppings" },
    });
    const bebidasCat = await Categoria.findOne({
      where: { nombre: "Bebidas" },
    });

    await Producto.bulkCreate([
      {
        nombre: "Muzza Grande",
        descripcion: "Pizza de muzzarella grande",
        precio_venta: 8500,
        costo_compra: 3000,
        stock: 100,
        categoria_id: pizzaClasicaCat.id,
      },
      {
        nombre: "Napolitana Grande",
        descripcion: "Pizza napolitana grande con tomate y ajo",
        precio_venta: 9200,
        costo_compra: 3500,
        stock: 90,
        categoria_id: pizzaClasicaCat.id,
      },
      {
        nombre: "Jamon y Morrones",
        descripcion: "Pizza de jamón y morrones grande",
        precio_venta: 9000,
        costo_compra: 3400,
        stock: 85,
        categoria_id: pizzaClasicaCat.id,
      },
      {
        nombre: "Fugazzeta Rellena",
        descripcion: "Pizza de fugazzeta rellena",
        precio_venta: 9800,
        costo_compra: 4000,
        stock: 70,
        categoria_id: pizzaEspecialCat.id,
      },
      {
        nombre: "Coca-Cola 1.5L",
        descripcion: "Gaseosa Coca-Cola 1.5 Litros",
        precio_venta: 1800,
        costo_compra: 800,
        stock: 200,
        categoria_id: bebidasCat.id,
      },
      {
        nombre: "Aceitunas Extra",
        descripcion: "Porción extra de aceitunas",
        precio_venta: 500,
        costo_compra: 150,
        stock: 500,
        categoria_id: toppingsCat.id,
      },
      {
        nombre: "Huevo Frito Extra",
        descripcion: "Huevo frito extra",
        precio_venta: 400,
        costo_compra: 100,
        stock: 300,
        categoria_id: toppingsCat.id,
      },
    ]);
    console.log("Productos de prueba insertados.");
  }

  // Verificar y cargar un usuario administrador de prueba
  const usuariosCount = await Usuario.count();
  if (usuariosCount === 0) {
    // Generar un hash para la contraseña 'admin123' antes de insertarla
    const adminPassword = "admin123";
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash(adminPassword, salt);

    await Usuario.create({
      nombre_usuario: "admin",
      password_hash: adminPasswordHash, // <-- ¡Ahora guardamos el hash!
      rol: "admin",
    });
    console.log("Usuario administrador de prueba insertado.");
  }

  // Verificar y cargar clientes de prueba
  const clientesCount = await Cliente.count();
  if (clientesCount === 0) {
    await Cliente.bulkCreate([
      {
        nombre: "Juan",
        apellido: "Perez",
        telefono: "3851112233",
        direccion: "Calle Falsa 123",
        email: "juan.perez@example.com",
      },
      {
        nombre: "Maria",
        apellido: "Gomez",
        telefono: "3854445566",
        direccion: "Av. Siempre Viva 742",
      },
      {
        nombre: "Carlos",
        apellido: "Lopez",
        telefono: "3857778899",
        direccion: "Boulevard del Sol 456",
      },
    ]);
    console.log("Clientes de prueba insertados.");
  }
}

// --- RUTAS API PARA PRODUCTOS ---

// 3.1. Ruta GET para obtener todos los productos
app.get("/api/productos", async (req, res) => {
  try {
    // Incluimos la categoría para poder mostrar el nombre de la categoría en el frontend
    const productos = await Producto.findAll({
      include: [
        {
          model: Categoria,
          attributes: ["nombre"], // Solo queremos el nombre de la categoría
        },
      ],
    });
    return res.status(200).json(productos);
  } catch (error) {
    console.error("Error al obtener productos:", error);
    return res.status(500).json({
      message: "Error interno del servidor al obtener productos.",
      error: error.message,
    });
  }
});

// 3.2. Ruta POST para crear un nuevo producto
app.post("/api/productos", async (req, res) => {
  const {
    nombre,
    descripcion,
    precio_venta,
    costo_compra,
    stock,
    categoria_id,
  } = req.body;

  // Validación básica
  if (!nombre || !precio_venta || !categoria_id) {
    return res.status(400).json({
      message: "Nombre, precio de venta y ID de categoría son obligatorios.",
    });
  }

  try {
    const nuevoProducto = await Producto.create({
      nombre,
      descripcion,
      precio_venta,
      costo_compra,
      stock,
      categoria_id,
    });
    return res.status(201).json(nuevoProducto); // 201 Created
  } catch (error) {
    console.error("Error al crear producto:", error);
    // Si el error es por nombre duplicado (unique: true en el modelo)
    if (error.name === "SequelizeUniqueConstraintError") {
      return res
        .status(409)
        .json({ message: "Ya existe un producto con este nombre." });
    }
    return res.status(500).json({
      message: "Error interno del servidor al crear producto.",
      error: error.message,
    });
  }
});

// 3.3. Ruta GET para obtener un producto por ID
app.get("/api/productos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const producto = await Producto.findByPk(id, {
      include: [
        {
          model: Categoria,
          attributes: ["nombre"],
        },
      ],
    });
    if (!producto) {
      return res.status(404).json({ message: "Producto no encontrado." });
    }
    return res.status(200).json(producto);
  } catch (error) {
    console.error("Error al obtener producto por ID:", error);
    return res.status(500).json({
      message: "Error interno del servidor al obtener producto.",
      error: error.message,
    });
  }
});

// 3.4. Ruta PUT para actualizar un producto existente
app.put("/api/productos/:id", async (req, res) => {
  const { id } = req.params;
  const {
    nombre,
    descripcion,
    precio_venta,
    costo_compra,
    stock,
    categoria_id,
  } = req.body;

  try {
    const producto = await Producto.findByPk(id);
    if (!producto) {
      return res
        .status(404)
        .json({ message: "Producto no encontrado para actualizar." });
    }

    // Actualiza solo los campos que se proporcionan en el body
    producto.nombre = nombre !== undefined ? nombre : producto.nombre;
    producto.descripcion =
      descripcion !== undefined ? descripcion : producto.descripcion;
    producto.precio_venta =
      precio_venta !== undefined ? precio_venta : producto.precio_venta;
    producto.costo_compra =
      costo_compra !== undefined ? costo_compra : producto.costo_compra;
    producto.stock = stock !== undefined ? stock : producto.stock;
    producto.categoria_id =
      categoria_id !== undefined ? categoria_id : producto.categoria_id;

    await producto.save(); // Guarda los cambios en la base de datos
    return res.status(200).json(producto);
  } catch (error) {
    console.error("Error al actualizar producto:", error);
    // Si el error es por nombre duplicado al actualizar (unique: true)
    if (error.name === "SequelizeUniqueConstraintError") {
      return res
        .status(409)
        .json({ message: "Ya existe otro producto con este nombre." });
    }
    return res.status(500).json({
      message: "Error interno del servidor al actualizar producto.",
      error: error.message,
    });
  }
});

// 3.5. Ruta DELETE para eliminar un producto
app.delete("/api/productos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const productoEliminado = await Producto.destroy({
      where: { id: id },
    });

    if (productoEliminado === 0) {
      // Si no se eliminó ningún registro
      return res
        .status(404)
        .json({ message: "Producto no encontrado para eliminar." });
    }
    return res.status(204).send(); // 204 No Content (éxito sin cuerpo de respuesta)
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    return res.status(500).json({
      message: "Error interno del servidor al eliminar producto.",
      error: error.message,
    });
  }
});
// 4.1. Ruta GET para obtener todos los clientes
app.get("/api/clientes", async (req, res) => {
  try {
    const clientes = await Cliente.findAll();
    return res.status(200).json(clientes);
  } catch (error) {
    console.error("Error al obtener clientes:", error);
    return res.status(500).json({
      message: "Error interno del servidor al obtener clientes.",
      error: error.message,
    });
  }
});

// 4.2. Ruta GET para buscar clientes por nombre/teléfono
app.get("/api/clientes/buscar", async (req, res) => {
  const { query } = req.query; // Obtener el parámetro 'query' de la URL (ej: /api/clientes/buscar?query=juan)

  if (!query) {
    return res
      .status(400)
      .json({ message: "Se requiere un parámetro de búsqueda (query)." });
  }

  try {
    const clientes = await Cliente.findAll({
      where: {
        // Buscar si el query coincide parcial o totalmente con nombre, apellido o teléfono
        [Sequelize.Op.or]: [
          { nombre: { [Sequelize.Op.like]: `%${query}%` } },
          { apellido: { [Sequelize.Op.like]: `%${query}%` } },
          { telefono: { [Sequelize.Op.like]: `%${query}%` } },
        ],
      },
    });
    return res.status(200).json(clientes);
  } catch (error) {
    console.error("Error al buscar clientes:", error);
    return res.status(500).json({
      message: "Error interno del servidor al buscar clientes.",
      error: error.message,
    });
  }
});

// 4.3. Ruta POST para crear un nuevo cliente
app.post("/api/clientes", async (req, res) => {
  const { nombre, apellido, telefono, direccion, email } = req.body;

  // Validación básica: nombre y teléfono son obligatorios
  if (!nombre || !telefono) {
    return res
      .status(400)
      .json({ message: "Nombre y teléfono del cliente son obligatorios." });
  }

  try {
    const nuevoCliente = await Cliente.create({
      nombre,
      apellido,
      telefono,
      direccion,
      email,
    });
    return res.status(201).json(nuevoCliente); // 201 Created
  } catch (error) {
    console.error("Error al crear cliente:", error);
    // Si el error es por teléfono o email duplicado (unique: true en el modelo)
    if (error.name === "SequelizeUniqueConstraintError") {
      return res
        .status(409)
        .json({ message: "Ya existe un cliente con este teléfono o email." });
    }
    return res.status(500).json({
      message: "Error interno del servidor al crear cliente.",
      error: error.message,
    });
  }
});

// 4.4. Ruta GET para obtener un cliente por ID
app.get("/api/clientes/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const cliente = await Cliente.findByPk(id);
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado." });
    }
    return res.status(200).json(cliente);
  } catch (error) {
    console.error("Error al obtener cliente por ID:", error);
    return res.status(500).json({
      message: "Error interno del servidor al obtener cliente.",
      error: error.message,
    });
  }
});

// 4.5. Ruta PUT para actualizar un cliente existente
app.put("/api/clientes/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, telefono, direccion, email } = req.body;

  try {
    const cliente = await Cliente.findByPk(id);
    if (!cliente) {
      return res
        .status(404)
        .json({ message: "Cliente no encontrado para actualizar." });
    }

    // Actualiza solo los campos que se proporcionan en el body
    cliente.nombre = nombre !== undefined ? nombre : cliente.nombre;
    cliente.apellido = apellido !== undefined ? apellido : cliente.apellido;
    cliente.telefono = telefono !== undefined ? telefono : cliente.telefono;
    cliente.direccion = direccion !== undefined ? direccion : cliente.direccion;
    cliente.email = email !== undefined ? email : cliente.email;

    await cliente.save(); // Guarda los cambios en la base de datos
    return res.status(200).json(cliente);
  } catch (error) {
    console.error("Error al actualizar cliente:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res
        .status(409)
        .json({ message: "Ya existe otro cliente con este teléfono o email." });
    }
    return res.status(500).json({
      message: "Error interno del servidor al actualizar cliente.",
      error: error.message,
    });
  }
});

// 4.6. Ruta DELETE para eliminar un cliente
// Considera si quieres una eliminación "física" o "lógica" (desactivar) en un entorno real.
app.delete("/api/clientes/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const clienteEliminado = await Cliente.destroy({
      where: { id: id },
    });

    if (clienteEliminado === 0) {
      // Si no se eliminó ningún registro
      return res
        .status(404)
        .json({ message: "Cliente no encontrado para eliminar." });
    }
    return res.status(204).send(); // 204 No Content (éxito sin cuerpo de respuesta)
  } catch (error) {
    console.error("Error al eliminar cliente:", error);
    return res.status(500).json({
      message: "Error interno del servidor al eliminar cliente.",
      error: error.message,
    });
  }
});
// 5.1. Ruta POST para registrar un nuevo usuario (Signup)
app.post("/api/auth/register", async (req, res) => {
  const { nombre_usuario, password, rol } = req.body;

  if (!nombre_usuario || !password) {
    return res
      .status(400)
      .json({ message: "Nombre de usuario y contraseña son obligatorios." });
  }

  try {
    // Generar un hash de la contraseña antes de guardarla
    const salt = await bcrypt.genSalt(10); // Genera una "sal" para fortalecer el hash
    const password_hash = await bcrypt.hash(password, salt); // Hashea la contraseña

    const nuevoUsuario = await Usuario.create({
      nombre_usuario,
      password_hash,
      rol: rol || "vendedor", // Si no se especifica, el rol por defecto es 'vendedor'
    });

    // No devolvemos el hash de la contraseña en la respuesta
    const userResponse = {
      id: nuevoUsuario.id,
      nombre_usuario: nuevoUsuario.nombre_usuario,
      rol: nuevoUsuario.rol,
    };

    return res.status(201).json({
      message: "Usuario registrado exitosamente.",
      user: userResponse,
    });
  } catch (error) {
    console.error("Error al registrar usuario:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res
        .status(409)
        .json({ message: "El nombre de usuario ya existe." });
    }
    return res.status(500).json({
      message: "Error interno del servidor al registrar usuario.",
      error: error.message,
    });
  }
});

// 5.2. Ruta POST para iniciar sesión (Login)
app.post("/api/auth/login", async (req, res) => {
  const { nombre_usuario, password } = req.body;

  if (!nombre_usuario || !password) {
    return res
      .status(400)
      .json({ message: "Nombre de usuario y contraseña son obligatorios." });
  }

  try {
    const usuario = await Usuario.findOne({ where: { nombre_usuario } });
    if (!usuario) {
      return res.status(401).json({ message: "Credenciales inválidas." });
    }

    // Comparar la contraseña proporcionada con el hash almacenado
    const isMatch = await bcrypt.compare(password, usuario.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Credenciales inválidas." });
    }

    // Generar un JSON Web Token (JWT)
    // Incluimos información básica en el payload del token
    const token = jwt.sign(
      {
        id: usuario.id,
        nombre_usuario: usuario.nombre_usuario,
        rol: usuario.rol,
      },
      process.env.JWT_SECRET, // Usamos la clave secreta del archivo .env
      { expiresIn: "1h" } // El token expirará en 1 hora
    );

    return res.status(200).json({
      message: "Inicio de sesión exitoso.",
      token,
      user: {
        id: usuario.id,
        nombre_usuario: usuario.nombre_usuario,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    return res.status(500).json({
      message: "Error interno del servidor al iniciar sesión.",
      error: error.message,
    });
  }
});

// 5.3. Middleware de autenticación JWT (para proteger rutas)
// Esto es un middleware que se ejecutará ANTES de las rutas protegidas.
// Lo usaremos en capítulos posteriores.
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization; // El token viene en el header 'Authorization: Bearer <token>'

  if (authHeader) {
    const token = authHeader.split(" ")[1]; // Extraemos el token después de 'Bearer '

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        // Si el token es inválido o expiró
        return res
          .status(403)
          .json({ message: "Acceso denegado. Token inválido o expirado." });
      }
      req.user = user; // Adjuntamos la información del usuario al objeto de solicitud (req)
      next(); // Continuamos con la siguiente función (la ruta protegida)
    });
  } else {
    return res.status(401).json({
      message: "Acceso denegado. No se proporcionó token de autenticación.",
    });
  }
};

// 5.4. Ruta de ejemplo protegida (solo para usuarios autenticados)
// Usaremos el middleware 'authenticateJWT' para proteger esta ruta.
app.get("/api/users/profile", authenticateJWT, (req, res) => {
  // Si llegamos aquí, el usuario está autenticado y su información está en req.user
  return res.status(200).json({
    message: "Acceso a perfil autorizado.",
    user: req.user,
  });
});

// 5.5. Ruta GET para obtener todos los usuarios (solo para admin - lo implementaremos luego)
// Por ahora, no protegemos esta ruta con roles específicos, solo autenticación.
app.get("/api/users", authenticateJWT, async (req, res) => {
  try {
    // En un sistema real, aquí verificarías el rol del usuario (ej. req.user.rol === 'admin')
    // para permitir el acceso a esta lista de usuarios.
    const usuarios = await Usuario.findAll({
      attributes: ["id", "nombre_usuario", "rol"], // No enviar password_hash
    });
    return res.status(200).json(usuarios);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    return res.status(500).json({
      message: "Error interno del servidor al obtener usuarios.",
      error: error.message,
    });
  }
});
// 6.1. Definición del modelo `Venta`
// Esta tabla registrará cada transacción de venta.
const Venta = sequelize.define(
  "Venta",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    fecha_venta: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW, // La fecha de la venta se registra automáticamente
    },
    total: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.0, // El total se calculará sumando los detalles
    },
    metodo_pago: {
      type: DataTypes.STRING,
      allowNull: false, // Ej: 'efectivo', 'tarjeta', 'transferencia'
    },
    estado: {
      type: DataTypes.STRING,
      defaultValue: "completada", // Ej: 'pendiente', 'completada', 'cancelada'
    },
    // `cliente_id` será una clave foránea para el cliente asociado a la venta
    // `usuario_id` será una clave foránea para el usuario que realizó la venta
  },
  {
    tableName: "ventas",
    timestamps: false,
  }
);

// 6.2. Definición del modelo `VentaDetalle`
// Esta tabla contendrá cada ítem (producto) dentro de una venta.
const VentaDetalle = sequelize.define(
  "VentaDetalle",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    precio_unitario: {
      type: DataTypes.FLOAT,
      allowNull: false, // El precio al que se vendió el producto en ese momento
    },
    subtotal: {
      type: DataTypes.FLOAT,
      allowNull: false, // `cantidad * precio_unitario`
    },
    // `venta_id` será una clave foránea para la venta a la que pertenece
    // `producto_id` será una clave foránea para el producto vendido
  },
  {
    tableName: "ventas_detalles",
    timestamps: false,
  }
);

// 6.3. Definir Relaciones entre Ventas, Clientes, Usuarios y Productos

// Una `Venta` pertenece a un `Cliente` (muchos a uno)
Venta.belongsTo(Cliente, {
  foreignKey: "cliente_id",
  targetKey: "id",
});
// Un `Cliente` puede tener muchas `Ventas` (uno a muchos)
Cliente.hasMany(Venta, {
  foreignKey: "cliente_id",
});

// Una `Venta` es realizada por un `Usuario` (muchos a uno)
Venta.belongsTo(Usuario, {
  foreignKey: "usuario_id",
  targetKey: "id",
});
// Un `Usuario` puede realizar muchas `Ventas` (uno a muchos)
Usuario.hasMany(Venta, {
  foreignKey: "usuario_id",
});

// Un `VentaDetalle` pertenece a una `Venta` (muchos a uno)
VentaDetalle.belongsTo(Venta, {
  foreignKey: "venta_id",
  targetKey: "id",
});
// Una `Venta` puede tener muchos `VentaDetalle` (uno a muchos)
Venta.hasMany(VentaDetalle, {
  foreignKey: "venta_id",
  onDelete: "CASCADE", // Si se elimina una venta, se eliminan sus detalles
});

// Un `VentaDetalle` se refiere a un `Producto` (muchos a uno)
VentaDetalle.belongsTo(Producto, {
  foreignKey: "producto_id",
  targetKey: "id",
});
// Un `Producto` puede estar en muchos `VentaDetalle` (uno a muchos)
Producto.hasMany(VentaDetalle, {
  foreignKey: "producto_id",
});

// 6.4. Ruta POST para registrar una nueva venta
// Esta ruta requiere autenticación.
app.post("/api/ventas", authenticateJWT, async (req, res) => {
  // En una aplicación real, aquí también se validaría el rol del usuario (ej. req.user.rol === 'vendedor' || req.user.rol === 'admin')
  const { cliente_id, metodo_pago, detalles, total } = req.body; // 'detalles' es un array de objetos { producto_id, cantidad, precio_unitario }

  if (!metodo_pago || !detalles || detalles.length === 0) {
    return res.status(400).json({
      message:
        "Método de pago y al menos un detalle de venta son obligatorios.",
    });
  }

  // Si no se proporciona un cliente_id, podemos crear una venta sin cliente asociado (venta al público)
  // O si quieres que siempre haya un cliente, podrías usar un cliente "Genérico" con ID 1 por ejemplo.

  // Obtenemos el ID del usuario autenticado del token JWT
  const usuario_id = req.user.id;

  const transaction = await sequelize.transaction(); // Iniciar una transacción para asegurar atomicidad

  try {
    // 1. Crear la Venta
    const nuevaVenta = await Venta.create(
      {
        cliente_id: cliente_id || null, // Permite ventas sin cliente asociado
        usuario_id: usuario_id,
        metodo_pago,
        total: total || 0, // El total se recalculará o se tomará del frontend, luego se valida
        estado: "completada",
      },
      { transaction }
    );

    let totalCalculado = 0;
    const detallesVenta = [];

    // 2. Procesar cada detalle de la venta
    for (const item of detalles) {
      const producto = await Producto.findByPk(item.producto_id, {
        transaction,
      });

      if (!producto) {
        await transaction.rollback(); // Deshacer si el producto no existe
        return res.status(404).json({
          message: `Producto con ID ${item.producto_id} no encontrado.`,
        });
      }

      if (producto.stock < item.cantidad) {
        await transaction.rollback(); // Deshacer si no hay suficiente stock
        return res.status(400).json({
          message: `No hay suficiente stock para ${producto.nombre}. Stock disponible: ${producto.stock}`,
        });
      }

      // Usar el precio de venta actual del producto si no se proporciona o es inconsistente
      const precioUnitarioReal = item.precio_unitario || producto.precio_venta;
      const subtotalItem = item.cantidad * precioUnitarioReal;
      totalCalculado += subtotalItem;

      detallesVenta.push({
        venta_id: nuevaVenta.id,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario: precioUnitarioReal,
        subtotal: subtotalItem,
      });

      // 3. Actualizar el stock del producto
      await producto.update(
        { stock: producto.stock - item.cantidad },
        { transaction }
      );
    }

    // 4. Guardar los detalles de la venta
    await VentaDetalle.bulkCreate(detallesVenta, { transaction });

    // 5. Actualizar el total final de la venta (si no se envió o para asegurar consistencia)
    await nuevaVenta.update({ total: totalCalculado }, { transaction });

    // 6. Si hay un cliente asociado, actualizar su 'ultima_compra'
    if (cliente_id) {
      const cliente = await Cliente.findByPk(cliente_id, { transaction });
      if (cliente) {
        await cliente.update({ ultima_compra: new Date() }, { transaction });
        // NOTA: Para el ticket_promedio necesitaríamos más lógica que la haremos luego.
      }
    }

    await transaction.commit(); // Confirmar la transacción

    // Incluimos los detalles y el nombre de los productos/categorías en la respuesta
    const ventaCompleta = await Venta.findByPk(nuevaVenta.id, {
      include: [
        {
          model: VentaDetalle,
          include: [
            {
              model: Producto,
              attributes: ["nombre", "descripcion"], // Incluir detalles del producto
            },
          ],
        },
        {
          model: Cliente,
          attributes: ["nombre", "apellido", "telefono"],
        },
        {
          model: Usuario,
          attributes: ["nombre_usuario"],
        },
      ],
    });

    return res.status(201).json({
      message: "Venta registrada exitosamente.",
      venta: ventaCompleta,
    });
  } catch (error) {
    await transaction.rollback(); // Deshacer la transacción si algo falla
    console.error("Error al registrar venta:", error);
    return res.status(500).json({
      message: "Error interno del servidor al registrar la venta.",
      error: error.message,
    });
  }
});

// 6.5. Ruta GET para obtener todas las ventas
// Esta ruta requiere autenticación.
app.get("/api/ventas", authenticateJWT, async (req, res) => {
  try {
    const ventas = await Venta.findAll({
      include: [
        {
          model: Cliente,
          attributes: ["nombre", "apellido", "telefono"],
        },
        {
          model: Usuario,
          attributes: ["nombre_usuario"],
        },
      ],
      order: [["fecha_venta", "DESC"]], // Ordenar por fecha de venta descendente
    });
    return res.status(200).json(ventas);
  } catch (error) {
    console.error("Error al obtener ventas:", error);
    return res.status(500).json({
      message: "Error interno del servidor al obtener ventas.",
      error: error.message,
    });
  }
});

// 6.6. Ruta GET para obtener una venta específica por ID (con sus detalles)
// Esta ruta requiere autenticación.
app.get("/api/ventas/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    const venta = await Venta.findByPk(id, {
      include: [
        {
          model: VentaDetalle,
          include: [
            {
              model: Producto,
              attributes: ["nombre", "descripcion"],
            },
          ],
        },
        {
          model: Cliente,
          attributes: ["nombre", "apellido", "telefono"],
        },
        {
          model: Usuario,
          attributes: ["nombre_usuario"],
        },
      ],
    });
    if (!venta) {
      return res.status(404).json({ message: "Venta no encontrada." });
    }
    return res.status(200).json(venta);
  } catch (error) {
    console.error("Error al obtener venta por ID:", error);
    return res.status(500).json({
      message: "Error interno del servidor al obtener la venta.",
      error: error.message,
    });
  }
});

// No implementamos PUT o DELETE para ventas directamente, ya que suelen manejarse
// con reversiones o anulaciones, no con modificación o eliminación directa de registros históricos.

//Ruta básica para verificar que el servidor funciona.
app.get("/", (req, res) => {
  res.send("Backend del POS de Santísima Pizzería funcionando!");
});

// Iniciar el servidor después de conectar y sincronizar la base de datos
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
  });
});
