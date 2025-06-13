const express = require("express");
const { Sequelize, DataTypes } = require("sequelize");
const path = require("path"); // Módulo para trabajar con rutas de archivos

const app = express();
const PORT = 3001; // Puerto en el que se ejecutará nuestro servidor backend

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
    // !!! IMPORTANTE: Por ahora, la contraseña 'admin123' se guarda sin hashear.
    // En el Capítulo 4, implementaremos el hashing seguro con bcrypt.
    await Usuario.create({
      nombre_usuario: "admin",
      password_hash: "admin123",
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
    return res
      .status(500)
      .json({
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
    return res
      .status(400)
      .json({
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
    return res
      .status(500)
      .json({
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
    return res
      .status(500)
      .json({
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
    return res
      .status(500)
      .json({
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
    return res
      .status(500)
      .json({
        message: "Error interno del servidor al eliminar producto.",
        error: error.message,
      });
  }
});
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
