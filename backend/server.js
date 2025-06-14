// --- 1. REQUIRES INICIALES ---
const express = require("express");
const { Sequelize, DataTypes, Op } = require("sequelize"); // Op para operadores de Sequelize
const path = require("path"); // Módulo para trabajar con rutas de archivos
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();
const Joi = require("joi"); // Para validación de esquemas

const app = express();
const PORT = 3001; // Puerto en el que se ejecutará nuestro servidor backend

// --- 2. CONFIGURACIÓN DE MIDDLEWARES GLOBALES DE EXPRESS ---
// Configuración de CORS para permitir la comunicación con el frontend
const corsOptions = {
  origin: process.env.FRONTEND_URL, // Permite solicitudes solo desde la URL de tu frontend (ej. http://localhost:5173)
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true, // Permite el envío de cookies o encabezados de autorización (para futuras expansiones)
  optionsSuccessStatus: 204, // Para respuestas preflight de CORS
};
app.use(cors(corsOptions));

// Middleware para parsear el cuerpo de las solicitudes JSON
app.use(express.json());

// --- 3. CONFIGURACIÓN DE SEQUELIZE Y CONEXIÓN A LA BASE DE DATOS ---
// La base de datos 'database.sqlite' se creará en la misma carpeta del backend.
const sequelize = new Sequelize({
  dialect: "sqlite", // Indica que usaremos SQLite
  storage: path.join(__dirname, "database.sqlite"), // Ruta del archivo de la base de datos
  logging: false, // Opcional: Desactiva los logs SQL en la consola para una salida más limpia
});

// --- 4. DEFINICIÓN DE MODELOS DE LA BASE DE DATOS ---
// Estos modelos representan las tablas en nuestra base de datos y sus relaciones.

// 4.1. Definición del modelo `Categoria`
const Categoria = sequelize.define(
  "Categoria",
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
  },
  {
    tableName: "categorias",
    timestamps: false,
  }
);

// 4.2. Definición del modelo `Producto`
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
      allowNull: true,
    },
    precio_venta: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    costo_compra: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    stock: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: "productos",
    timestamps: false,
  }
);

// 4.3. Definición del modelo `Cliente`
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
      unique: true,
    },
    direccion: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    fecha_registro: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    ultima_compra: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ticket_promedio: {
      type: DataTypes.FLOAT,
      defaultValue: 0.0,
    },
    productos_favoritos: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue("productos_favoritos");
        return rawValue ? JSON.parse(rawValue) : [];
      },
      set(value) {
        this.setDataValue("productos_favoritos", JSON.stringify(value));
      },
    },
  },
  {
    tableName: "clientes",
    timestamps: false,
  }
);

// 4.4. Definición del modelo `Usuario`
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
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    rol: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "vendedor",
    },
  },
  {
    tableName: "usuarios",
    timestamps: false,
  }
);

// 4.5. Definición del modelo `Venta`
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
      defaultValue: DataTypes.NOW,
    },
    total: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.0,
    },
    metodo_pago: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    estado: {
      type: DataTypes.STRING,
      defaultValue: "completada",
    },
  },
  {
    tableName: "ventas",
    timestamps: false,
  }
);

// 4.6. Definición del modelo `VentaDetalle`
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
      allowNull: false,
    },
    subtotal: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
  },
  {
    tableName: "ventas_detalles",
    timestamps: false,
  }
);

// --- 5. DEFINICIÓN DE RELACIONES ENTRE MODELOS ---

Producto.belongsTo(Categoria, { foreignKey: "categoria_id", targetKey: "id" });
Categoria.hasMany(Producto, { foreignKey: "categoria_id" });

Venta.belongsTo(Cliente, { foreignKey: "cliente_id", targetKey: "id" });
Cliente.hasMany(Venta, { foreignKey: "cliente_id" });

Venta.belongsTo(Usuario, { foreignKey: "usuario_id", targetKey: "id" });
Usuario.hasMany(Venta, { foreignKey: "usuario_id" });

VentaDetalle.belongsTo(Venta, { foreignKey: "venta_id", targetKey: "id" });
Venta.hasMany(VentaDetalle, { foreignKey: "venta_id", onDelete: "CASCADE" });

VentaDetalle.belongsTo(Producto, {
  foreignKey: "producto_id",
  targetKey: "id",
});
Producto.hasMany(VentaDetalle, { foreignKey: "producto_id" });

// --- 6. FUNCIÓN DE CONEXIÓN A LA DB E INSERCIÓN DE DATOS DE PRUEBA ---

// Función asíncrona para conectar a la base de datos y sincronizar los modelos
async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log("Conexión a la base de datos establecida correctamente.");
    await sequelize.sync({ force: true }); // CUIDADO: `force: true` recrea tablas (usar en dev)
    console.log(
      "Modelos sincronizados con la base de datos (tablas creadas/actualizadas)."
    );

    await insertTestData();
  } catch (error) {
    console.error("Error al conectar o sincronizar la base de datos:", error);
    process.exit(1);
  }
}

// Función para insertar datos de prueba en las tablas
async function insertTestData() {
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

  const productosCount = await Producto.count();
  if (productosCount === 0) {
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

  const usuariosCount = await Usuario.count();
  if (usuariosCount === 0) {
    const adminPassword = "admin123";
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash(adminPassword, salt);

    await Usuario.create({
      nombre_usuario: "admin",
      password_hash: adminPasswordHash,
      rol: "admin",
    });
    console.log("Usuario administrador de prueba insertado.");
  }

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

// --- 7. MIDDLEWARES DE AUTENTICACIÓN, AUTORIZACIÓN Y VALIDACIÓN ---
// ESTAS DEFINICIONES DEBEN IR ANTES DE LAS RUTAS API QUE LAS USAN.

// Middleware de autenticación JWT
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return res
          .status(403)
          .json({ message: "Acceso denegado. Token inválido o expirado." });
      }
      req.user = user;
      next();
    });
  } else {
    return res.status(401).json({
      message: "Acceso denegado. No se proporcionó token de autenticación.",
    });
  }
};

// Middleware de Autorización JWT basado en Roles
const authorizeRoles = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({
        message: "Acceso denegado. No tiene los permisos necesarios.",
      });
    }
    next();
  };
};

// Middleware de Validación de Datos (Joi)
const validate = (schema, property) => (req, res, next) => {
  const { error } = schema.validate(req[property]);
  const valid = error == null;

  if (valid) {
    next();
  } else {
    const { details } = error;
    const message = details.map((i) => i.message).join(",");
    console.error("Error de validación:", message);
    res
      .status(422)
      .json({ message: "Error de validación de datos.", details: message });
  }
};

// --- 8. ESQUEMAS DE VALIDACIÓN JOI ---
const schemas = {
  productoPOST: Joi.object({
    nombre: Joi.string().trim().min(3).max(100).required(),
    descripcion: Joi.string().trim().max(255).allow(null, ""),
    precio_venta: Joi.number().min(0.01).required(),
    costo_compra: Joi.number().min(0).allow(null, 0),
    stock: Joi.number().integer().min(0).default(0),
    categoria_id: Joi.number().integer().min(1).required(),
  }),
  productoPUT: Joi.object({
    nombre: Joi.string().trim().min(3).max(100),
    descripcion: Joi.string().trim().max(255).allow(null, ""),
    precio_venta: Joi.number().min(0.01),
    costo_compra: Joi.number().min(0).allow(null, 0),
    stock: Joi.number().integer().min(0),
    categoria_id: Joi.number().integer().min(1),
  }).min(1),

  clientePOST: Joi.object({
    nombre: Joi.string().trim().min(2).max(100).required(),
    apellido: Joi.string().trim().max(100).allow(null, ""),
    telefono: Joi.string()
      .trim()
      .pattern(/^[0-9]{7,15}$/)
      .required(),
    direccion: Joi.string().trim().max(255).allow(null, ""),
    email: Joi.string().email().max(100).allow(null, ""),
  }),
  clientePUT: Joi.object({
    nombre: Joi.string().trim().min(2).max(100),
    apellido: Joi.string().trim().max(100).allow(null, ""),
    telefono: Joi.string()
      .trim()
      .pattern(/^[0-9]{7,15}$/),
    direccion: Joi.string().trim().max(255).allow(null, ""),
    email: Joi.string().email().max(100).allow(null, ""),
  }).min(1),

  usuarioRegister: Joi.object({
    nombre_usuario: Joi.string().trim().min(3).max(50).required(),
    password: Joi.string().min(6).required(),
    rol: Joi.string().valid("admin", "vendedor").default("vendedor"),
  }),
  usuarioLogin: Joi.object({
    nombre_usuario: Joi.string().trim().required(),
    password: Joi.string().required(),
  }),

  ventaPOST: Joi.object({
    cliente_id: Joi.number().integer().min(1).allow(null),
    metodo_pago: Joi.string()
      .valid("efectivo", "tarjeta", "transferencia", "otros")
      .required(),
    detalles: Joi.array()
      .items(
        Joi.object({
          producto_id: Joi.number().integer().min(1).required(),
          cantidad: Joi.number().integer().min(1).required(),
          precio_unitario: Joi.number().min(0.01).required(),
        })
      )
      .min(1)
      .required(),
    total: Joi.number().min(0).allow(null),
  }),
  reporteVentasFecha: Joi.object({
    start_date: Joi.date().iso().required(),
    end_date: Joi.date().iso().required(),
  }),
};

// --- 9. RUTAS API ---

// Ruta básica para verificar que el servidor funciona.
app.get("/", (req, res) => {
  res.send("Backend del POS de Santísima Pizzería funcionando!");
});

// --- RUTAS API PARA PRODUCTOS ---
app.get("/api/productos", authenticateJWT, async (req, res) => {
  try {
    const productos = await Producto.findAll({
      include: [{ model: Categoria, attributes: ["nombre"] }],
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

app.post(
  "/api/productos",
  authenticateJWT,
  authorizeRoles(["admin", "vendedor"]),
  validate(schemas.productoPOST, "body"),
  async (req, res) => {
    const {
      nombre,
      descripcion,
      precio_venta,
      costo_compra,
      stock,
      categoria_id,
    } = req.body;
    try {
      const nuevoProducto = await Producto.create({
        nombre,
        descripcion,
        precio_venta,
        costo_compra,
        stock,
        categoria_id,
      });
      return res.status(201).json(nuevoProducto);
    } catch (error) {
      console.error("Error al crear producto:", error);
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
  }
);

app.get("/api/productos/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    const producto = await Producto.findByPk(id, {
      include: [{ model: Categoria, attributes: ["nombre"] }],
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

app.put(
  "/api/productos/:id",
  authenticateJWT,
  authorizeRoles(["admin", "vendedor"]),
  validate(schemas.productoPUT, "body"),
  async (req, res) => {
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

      await producto.save();
      return res.status(200).json(producto);
    } catch (error) {
      console.error("Error al actualizar producto:", error);
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
  }
);

app.delete(
  "/api/productos/:id",
  authenticateJWT,
  authorizeRoles(["admin"]),
  async (req, res) => {
    const { id } = req.params;
    try {
      const productoEliminado = await Producto.destroy({ where: { id: id } });
      if (productoEliminado === 0) {
        return res
          .status(404)
          .json({ message: "Producto no encontrado para eliminar." });
      }
      return res.status(204).send();
    } catch (error) {
      console.error("Error al eliminar producto:", error);
      return res.status(500).json({
        message: "Error interno del servidor al eliminar producto.",
        error: error.message,
      });
    }
  }
);

// --- RUTAS API PARA CLIENTES ---
app.get("/api/clientes", authenticateJWT, async (req, res) => {
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

app.get("/api/clientes/buscar", authenticateJWT, async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res
      .status(400)
      .json({ message: "Se requiere un parámetro de búsqueda (query)." });
  }
  try {
    const clientes = await Cliente.findAll({
      where: {
        [Op.or]: [
          { nombre: { [Op.like]: `%${query}%` } },
          { apellido: { [Op.like]: `%${query}%` } },
          { telefono: { [Op.like]: `%${query}%` } },
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

app.post(
  "/api/clientes",
  authenticateJWT,
  authorizeRoles(["admin", "vendedor"]),
  validate(schemas.clientePOST, "body"),
  async (req, res) => {
    const { nombre, apellido, telefono, direccion, email } = req.body;
    try {
      const nuevoCliente = await Cliente.create({
        nombre,
        apellido,
        telefono,
        direccion,
        email,
      });
      return res.status(201).json(nuevoCliente);
    } catch (error) {
      console.error("Error al crear cliente:", error);
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
  }
);

app.get("/api/clientes/:id", authenticateJWT, async (req, res) => {
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

app.put(
  "/api/clientes/:id",
  authenticateJWT,
  authorizeRoles(["admin", "vendedor"]),
  validate(schemas.clientePUT, "body"),
  async (req, res) => {
    const { id } = req.params;
    const { nombre, apellido, telefono, direccion, email } = req.body;
    try {
      const cliente = await Cliente.findByPk(id);
      if (!cliente) {
        return res
          .status(404)
          .json({ message: "Cliente no encontrado para actualizar." });
      }
      cliente.nombre = nombre !== undefined ? nombre : cliente.nombre;
      cliente.apellido = apellido !== undefined ? apellido : cliente.apellido;
      cliente.telefono = telefono !== undefined ? telefono : cliente.telefono;
      cliente.direccion =
        direccion !== undefined ? direccion : cliente.direccion;
      cliente.email = email !== undefined ? email : cliente.email;

      await cliente.save();
      return res.status(200).json(cliente);
    } catch (error) {
      console.error("Error al actualizar cliente:", error);
      if (error.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({
          message: "Ya existe otro cliente con este teléfono o email.",
        });
      }
      return res.status(500).json({
        message: "Error interno del servidor al actualizar cliente.",
        error: error.message,
      });
    }
  }
);

app.delete(
  "/api/clientes/:id",
  authenticateJWT,
  authorizeRoles(["admin"]),
  async (req, res) => {
    const { id } = req.params;
    try {
      const clienteEliminado = await Cliente.destroy({ where: { id: id } });
      if (clienteEliminado === 0) {
        return res
          .status(404)
          .json({ message: "Cliente no encontrado para eliminar." });
      }
      return res.status(204).send();
    } catch (error) {
      console.error("Error al eliminar cliente:", error);
      return res.status(500).json({
        message: "Error interno del servidor al eliminar cliente.",
        error: error.message,
      });
    }
  }
);

// --- RUTAS API PARA USUARIOS Y AUTENTICACIÓN ---
app.post(
  "/api/auth/register",
  validate(schemas.usuarioRegister, "body"),
  async (req, res) => {
    const { nombre_usuario, password, rol } = req.body;
    try {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);

      const nuevoUsuario = await Usuario.create({
        nombre_usuario,
        password_hash,
        rol: rol || "vendedor",
      });
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
  }
);

app.post(
  "/api/auth/login",
  validate(schemas.usuarioLogin, "body"),
  async (req, res) => {
    const { nombre_usuario, password } = req.body;
    try {
      const usuario = await Usuario.findOne({ where: { nombre_usuario } });
      if (!usuario) {
        return res.status(401).json({ message: "Credenciales inválidas." });
      }
      const isMatch = await bcrypt.compare(password, usuario.password_hash);
      if (!isMatch) {
        return res.status(401).json({ message: "Credenciales inválidas." });
      }
      const token = jwt.sign(
        {
          id: usuario.id,
          nombre_usuario: usuario.nombre_usuario,
          rol: usuario.rol,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
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
  }
);

app.get("/api/users/profile", authenticateJWT, (req, res) => {
  return res
    .status(200)
    .json({ message: "Acceso a perfil autorizado.", user: req.user });
});

app.get(
  "/api/users",
  authenticateJWT,
  authorizeRoles(["admin"]),
  async (req, res) => {
    try {
      const usuarios = await Usuario.findAll({
        attributes: ["id", "nombre_usuario", "rol"],
      });
      return res.status(200).json(usuarios);
    } catch (error) {
      console.error("Error al obtener usuarios:", error);
      return res.status(500).json({
        message: "Error interno del servidor al obtener usuarios.",
        error: error.message,
      });
    }
  }
);

// --- RUTAS API PARA VENTAS Y DETALLES DE VENTA ---
app.post(
  "/api/ventas",
  authenticateJWT,
  authorizeRoles(["admin", "vendedor"]),
  validate(schemas.ventaPOST, "body"),
  async (req, res) => {
    const { cliente_id, metodo_pago, detalles, total } = req.body;
    const usuario_id = req.user.id;
    const transaction = await sequelize.transaction();

    try {
      const nuevaVenta = await Venta.create(
        {
          cliente_id: cliente_id || null,
          usuario_id: usuario_id,
          metodo_pago,
          total: total || 0,
          estado: "completada",
        },
        { transaction }
      );

      let totalCalculado = 0;
      const detallesVenta = [];

      for (const item of detalles) {
        const producto = await Producto.findByPk(item.producto_id, {
          transaction,
        });
        if (!producto) {
          await transaction.rollback();
          return res.status(404).json({
            message: `Producto con ID ${item.producto_id} no encontrado.`,
          });
        }
        if (producto.stock < item.cantidad) {
          await transaction.rollback();
          return res.status(400).json({
            message: `No hay suficiente stock para ${producto.nombre}. Stock disponible: ${producto.stock}`,
          });
        }
        const precioUnitarioReal =
          item.precio_unitario || producto.precio_venta;
        const subtotalItem = item.cantidad * precioUnitarioReal;
        totalCalculado += subtotalItem;

        detallesVenta.push({
          venta_id: nuevaVenta.id,
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          precio_unitario: precioUnitarioReal,
          subtotal: subtotalItem,
        });

        await producto.update(
          { stock: producto.stock - item.cantidad },
          { transaction }
        );
      }

      await VentaDetalle.bulkCreate(detallesVenta, { transaction });
      await nuevaVenta.update({ total: totalCalculado }, { transaction });

      if (cliente_id) {
        const cliente = await Cliente.findByPk(cliente_id, { transaction });
        if (cliente) {
          await cliente.update({ ultima_compra: new Date() }, { transaction });
        }
      }

      await transaction.commit();

      const ventaCompleta = await Venta.findByPk(nuevaVenta.id, {
        include: [
          {
            model: VentaDetalle,
            include: [
              { model: Producto, attributes: ["nombre", "descripcion"] },
            ],
          },
          { model: Cliente, attributes: ["nombre", "apellido", "telefono"] },
          { model: Usuario, attributes: ["nombre_usuario"] },
        ],
      });
      return res.status(201).json({
        message: "Venta registrada exitosamente.",
        venta: ventaCompleta,
      });
    } catch (error) {
      await transaction.rollback();
      console.error("Error al registrar venta:", error);
      return res.status(500).json({
        message: "Error interno del servidor al registrar la venta.",
        error: error.message,
      });
    }
  }
);

app.get(
  "/api/ventas",
  authenticateJWT,
  authorizeRoles(["admin", "vendedor"]),
  async (req, res) => {
    try {
      const ventas = await Venta.findAll({
        include: [
          { model: Cliente, attributes: ["nombre", "apellido", "telefono"] },
          { model: Usuario, attributes: ["nombre_usuario"] },
        ],
        order: [["fecha_venta", "DESC"]],
      });
      return res.status(200).json(ventas);
    } catch (error) {
      console.error("Error al obtener ventas:", error);
      return res.status(500).json({
        message: "Error interno del servidor al obtener ventas.",
        error: error.message,
      });
    }
  }
);

app.get(
  "/api/ventas/:id",
  authenticateJWT,
  authorizeRoles(["admin", "vendedor"]),
  async (req, res) => {
    const { id } = req.params;
    try {
      const venta = await Venta.findByPk(id, {
        include: [
          {
            model: VentaDetalle,
            include: [
              { model: Producto, attributes: ["nombre", "descripcion"] },
            ],
          },
          { model: Cliente, attributes: ["nombre", "apellido", "telefono"] },
          { model: Usuario, attributes: ["nombre_usuario"] },
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
  }
);

// --- RUTAS API PARA REPORTES Y RESÚMENES ---
app.get(
  "/api/reportes/ventas-diarias",
  authenticateJWT,
  authorizeRoles(["admin", "vendedor"]),
  async (req, res) => {
    try {
      const ventasDiarias = await Venta.findAll({
        attributes: [
          [sequelize.fn("date", sequelize.col("fecha_venta")), "fecha"],
          [sequelize.fn("SUM", sequelize.col("total")), "totalVentasDia"],
          [sequelize.fn("COUNT", sequelize.col("id")), "cantidadVentasDia"],
        ],
        group: [sequelize.fn("date", sequelize.col("fecha_venta"))],
        order: [[sequelize.fn("date", sequelize.col("fecha_venta")), "DESC"]],
      });
      return res.status(200).json(ventasDiarias);
    } catch (error) {
      console.error("Error al obtener reporte de ventas diarias:", error);
      return res.status(500).json({
        message:
          "Error interno del servidor al obtener reporte de ventas diarias.",
        error: error.message,
      });
    }
  }
);

app.get(
  "/api/reportes/ventas-por-fecha",
  authenticateJWT,
  authorizeRoles(["admin", "vendedor"]),
  validate(schemas.reporteVentasFecha, "query"),
  async (req, res) => {
    const { start_date, end_date } = req.query;
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    endDate.setHours(23, 59, 59, 999);

    try {
      const totalVentas = await Venta.sum("total", {
        where: {
          fecha_venta: {
            [Op.between]: [startDate, endDate],
          },
        },
      });

      const cantidadVentas = await Venta.count({
        where: {
          fecha_venta: {
            [Op.between]: [startDate, endDate],
          },
        },
      });

      return res.status(200).json({
        start_date: start_date,
        end_date: end_date,
        total_ventas: totalVentas || 0,
        cantidad_ventas: cantidadVentas,
      });
    } catch (error) {
      console.error("Error al obtener reporte de ventas por fecha:", error);
      return res.status(500).json({
        message:
          "Error interno del servidor al obtener reporte de ventas por fecha.",
        error: error.message,
      });
    }
  }
);

app.get(
  "/api/reportes/productos-mas-vendidos",
  authenticateJWT,
  authorizeRoles(["admin", "vendedor"]),
  async (req, res) => {
    try {
      const productosVendidos = await VentaDetalle.findAll({
        attributes: [
          "producto_id",
          [
            sequelize.fn("SUM", sequelize.col("cantidad")),
            "cantidadTotalVendida",
          ],
        ],
        include: [{ model: Producto, attributes: ["nombre", "descripcion"] }],
        group: ["producto_id", "Producto.id"],
        order: [[sequelize.fn("SUM", sequelize.col("cantidad")), "DESC"]],
        limit: 10,
      });
      return res.status(200).json(productosVendidos);
    } catch (error) {
      console.error(
        "Error al obtener reporte de productos más vendidos:",
        error
      );
      return res.status(500).json({
        message:
          "Error interno del servidor al obtener reporte de productos más vendidos.",
        error: error.message,
      });
    }
  }
);

app.get(
  "/api/reportes/clientes-top",
  authenticateJWT,
  authorizeRoles(["admin", "vendedor"]),
  async (req, res) => {
    try {
      const clientesTop = await Venta.findAll({
        attributes: [
          "cliente_id",
          [sequelize.fn("COUNT", sequelize.col("Venta.id")), "totalCompras"],
        ],
        include: [
          { model: Cliente, attributes: ["nombre", "apellido", "telefono"] },
        ],
        group: ["cliente_id", "Cliente.id"],
        order: [[sequelize.fn("COUNT", sequelize.col("Venta.id")), "DESC"]],
        limit: 10,
      });
      return res.status(200).json(clientesTop);
    } catch (error) {
      console.error("Error al obtener reporte de clientes top:", error);
      return res.status(500).json({
        message:
          "Error interno del servidor al obtener reporte de clientes top.",
        error: error.message,
      });
    }
  }
);

// --- 10. MIDDLEWARE DE MANEJO DE ERRORES GLOBAL (AL FINAL DE LAS RUTAS) ---
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({
      message: "Conflicto de datos: El registro ya existe.",
      details: err.errors.map((e) => e.message),
    });
  }
  if (err.name === "SequelizeValidationError") {
    return res.status(400).json({
      message: "Error de validación de Sequelize.",
      details: err.errors.map((e) => e.message),
    });
  }
  if (err.name === "SequelizeForeignKeyConstraintError") {
    return res.status(400).json({
      message: "Error de clave foránea. Verifique los IDs relacionados.",
      details: err.message,
    });
  }
  res
    .status(500)
    .json({ message: "Algo salió mal en el servidor.", error: err.message });
});

// Iniciar el servidor después de conectar y sincronizar la base de datos
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
  });
});
