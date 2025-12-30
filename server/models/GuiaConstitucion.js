import mongoose from 'mongoose';

const guiaConstitucionSchema = new mongoose.Schema({
  contentHTML: {
    type: String,
    default: `
      <h2>Cómo crear una organización comunitaria</h2>
      <p>Las organizaciones comunitarias son fundamentales para el desarrollo de nuestra comuna. A continuación, te explicamos los pasos para constituir legalmente tu organización.</p>

      <h3>1. Requisitos previos</h3>
      <ul>
        <li>Reunir al menos 15 personas mayores de 18 años que residan en la misma unidad vecinal</li>
        <li>Definir el tipo de organización (Junta de Vecinos, Club Deportivo, Centro Cultural, etc.)</li>
        <li>Elegir un nombre para la organización</li>
      </ul>

      <h3>2. Asamblea constitutiva</h3>
      <p>Deben realizar una asamblea constitutiva donde:</p>
      <ul>
        <li>Se aprueben los estatutos de la organización</li>
        <li>Se elija la directiva (Presidente, Secretario, Tesorero)</li>
        <li>Se firme el acta constitutiva por todos los asistentes</li>
      </ul>

      <h3>3. Documentos necesarios</h3>
      <ul>
        <li>Acta de asamblea constitutiva</li>
        <li>Estatutos de la organización</li>
        <li>Nómina de socios fundadores con RUT y firma</li>
        <li>Declaración de directiva electa</li>
      </ul>

      <h3>4. Presentación ante el Municipio</h3>
      <p>Una vez reunidos todos los documentos, debes presentarlos en la Oficina de Organizaciones Comunitarias de la Municipalidad para su revisión y aprobación.</p>

      <h3>5. Obtención de personalidad jurídica</h3>
      <p>La Municipalidad revisará los documentos y, si están correctos, otorgará el certificado de personalidad jurídica, lo que permite a la organización operar legalmente.</p>
    `
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isPublished: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Solo puede haber un documento de guía
guiaConstitucionSchema.statics.getOrCreate = async function() {
  let guia = await this.findOne();
  if (!guia) {
    guia = await this.create({});
  }
  return guia;
};

export default mongoose.model('GuiaConstitucion', guiaConstitucionSchema);
