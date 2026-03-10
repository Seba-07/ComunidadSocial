# Whitepaper de Seguridad: ComunidadSocial
## Modulo Anti-SSRF y Proteccion de Red Municipal

**Version:** 1.0
**Fecha:** 10 de marzo de 2026
**Destinatario:** Departamento de TI, Ilustre Municipalidad de Renca
**Clasificacion:** Documento Tecnico — Uso Interno

---

## 1. Resumen Ejecutivo

La plataforma ComunidadSocial implementa un **Modulo Anti-SSRF** (Server-Side Request Forgery) que, una vez activado en ambiente de produccion, **bloquea de forma absoluta** cualquier intento de la aplicacion cliente de realizar peticiones HTTP hacia direcciones IP privadas, rangos de intranet o dispositivos en la red local (LAN/VLAN) de la municipalidad.

Este documento describe el mecanismo tecnico, su configuracion, y las garantias de seguridad que ofrece al Departamento de TI.

---

## 2. Problema: Riesgo SSRF en Redes Internas

Cuando una aplicacion web se ejecuta en dispositivos conectados a una red corporativa, existe el riesgo teorico de que peticiones HTTP maliciosas (generadas por codigo inyectado, extensiones del navegador, o vulnerabilidades XSS) puedan:

- Escanear puertos de la red interna (port scanning)
- Acceder a servicios internos no expuestos a Internet (bases de datos, paneles de administracion, impresoras de red)
- Enumerar dispositivos en la LAN/VLAN municipal
- Exfiltrar informacion de servicios internos

Estos ataques se conocen como **SSRF** (Server-Side Request Forgery) y estan catalogados en el **OWASP Top 10 (A10:2021)**.

---

## 3. Solucion Implementada

### 3.1 Interceptor Anti-SSRF en el Cliente

La aplicacion implementa un interceptor global en su capa de comunicaciones HTTP (`ApiService.js`) que evalua **todas** las peticiones salientes antes de ejecutarlas.

**Rangos bloqueados cuando el modulo esta activo:**

| Rango IP | Tipo | Descripcion |
|----------|------|-------------|
| `127.0.0.1`, `localhost`, `::1`, `0.0.0.0` | Loopback | Direccion local del dispositivo |
| `10.0.0.0/8` | RFC 1918 | Red privada clase A |
| `172.16.0.0/12` | RFC 1918 | Red privada clase B |
| `192.168.0.0/16` | RFC 1918 | Red privada clase C |
| `169.254.0.0/16` | Link-Local | Direcciones autoasignadas (APIPA) |
| `fc00::/7` | IPv6 ULA | Unique Local Address IPv6 |
| `fe80::/10` | IPv6 Link-Local | Enlace local IPv6 |

**Comportamiento al detectar una violacion:**

1. La peticion HTTP se **aborta inmediatamente** (nunca sale del navegador)
2. Se lanza una excepcion con el mensaje: `Network violation: Local IP request blocked by security policy`
3. No se transmite ningun paquete a la red interna
4. El error se registra en la consola del navegador para auditoria

### 3.2 Control por Variable de Entorno

El modulo se activa mediante la variable de entorno:

```
VITE_ENABLE_STRICT_LOCAL_NETWORK_BLOCK=true
```

| Valor | Comportamiento |
|-------|---------------|
| `true` | **ACTIVO** — Bloquea todas las peticiones a IPs privadas. Recomendado para produccion. |
| `false` (default) | **INACTIVO** — Permite peticiones a localhost para desarrollo local. |

**Nota:** En el ambiente de produccion desplegado en Vercel, esta variable se configura en el panel de Environment Variables del proyecto y se aplica en cada build.

### 3.3 Proteccion del Backend

El servidor backend esta desplegado en **Railway** (infraestructura cloud aislada), no en la red municipal. Esto significa que:

- El backend **no tiene acceso fisico** a la LAN/VLAN municipal
- Las peticiones del backend solo se comunican con MongoDB Atlas (cloud) y servicios externos autorizados
- No existe ruta de red entre el servidor y los dispositivos de la intranet municipal

---

## 4. Arquitectura de Red Recomendada

```
┌──────────────────────────────────────────────────────────┐
│  RED MUNICIPAL (LAN/VLAN)                                │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Servidores  │  │ Impresoras  │  │ Equipos TI  │     │
│  │ Internos    │  │ de Red      │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│        ╳                ╳                ╳               │
│   BLOQUEADO        BLOQUEADO        BLOQUEADO            │
│        ╳                ╳                ╳               │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Navegador con ComunidadSocial                   │   │
│  │  (Anti-SSRF ACTIVO)                              │   │
│  │                                                  │   │
│  │  Solo permite:                                   │   │
│  │  ✓ comunidad-social.vercel.app (Frontend)        │   │
│  │  ✓ /api/* → Railway backend (Proxy Vercel)       │   │
│  └──────────────────────────────────────────────────┘   │
│               │                                          │
│               │ HTTPS (solo dominios publicos)           │
│               ▼                                          │
└──────────────── Firewall Municipal ──────────────────────┘
                │
                │  Internet
                ▼
  ┌─────────────────────┐     ┌────────────────────┐
  │  Vercel (Frontend)  │────▶│  Railway (Backend)  │
  │  CDN Global         │     │  Express + Node.js  │
  └─────────────────────┘     └────────┬───────────┘
                                       │
                                       ▼
                              ┌────────────────────┐
                              │  MongoDB Atlas      │
                              │  (Cloud Database)   │
                              └────────────────────┘
```

---

## 5. Recomendaciones Adicionales de TI

### 5.1 Red Wi-Fi Dedicada tipo "Guest"

Para maximizar el aislamiento, se recomienda que los dispositivos que accedan a ComunidadSocial se conecten a una **red Wi-Fi tipo Guest** que:

- **No tenga acceso** a la VLAN de servidores internos
- Tenga **salida directa a Internet** (sin proxy que interfiera con HTTPS)
- Aplique **QoS** (Quality of Service) basico para garantizar ancho de banda
- Mantenga **aislamiento de cliente** (client isolation) para que los dispositivos no se vean entre si

### 5.2 Politica de CORS (Cross-Origin Resource Sharing)

El backend solo acepta peticiones desde origenes autorizados:

- `https://comunidad-social.vercel.app`
- `https://comunidadsocial.vercel.app`
- `localhost` (solo en desarrollo)

Cualquier peticion desde un origen no autorizado es rechazada con error CORS.

### 5.3 Content Security Policy (CSP)

La aplicacion implementa headers CSP que restringen:

- **Scripts**: Solo del mismo origen (no inline arbitrario)
- **Conexiones**: Solo al dominio autorizado
- **Frames**: No se permite embedding en iframes de terceros

### 5.4 Autenticacion y Sesiones

- Tokens JWT en cookies **HttpOnly** (no accesibles desde JavaScript)
- Cookies **Secure** y **SameSite=Lax** en produccion
- Timeout de inactividad: 3 minutos con advertencia visual
- Refresh token con expiracion de 30 dias

---

## 6. Cumplimiento y Referencias

| Marco | Referencia |
|-------|-----------|
| OWASP Top 10 (2021) | A10:2021 — Server-Side Request Forgery |
| Ley 19.628 | Proteccion de la Vida Privada (datos personales) |
| Ley 21.719 | Nuevas obligaciones de proteccion de datos (vigencia: dic. 2026) |
| Ley 19.799 | Documentos Electronicos y Firma Electronica (FEA) |
| NCh-ISO 27001 | Gestion de Seguridad de la Informacion |

---

## 7. Contacto

Para consultas tecnicas sobre esta implementacion, contactar al equipo de desarrollo:

- **Repositorio**: Privado (GitHub)
- **Ambiente de produccion**: Vercel + Railway
- **Base de datos**: MongoDB Atlas (M0, Region: us-east-1)

---

*Este documento es proporcionado como parte del proceso de adopcion tecnologica y no constituye una auditoria de seguridad formal. Se recomienda complementar con una evaluacion de seguridad independiente si el Departamento de TI lo estima necesario.*
