import { Archive, ArchiveRestore, BookOpen, CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import { z } from "zod";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { loadAdminFormats } from "@/features/admin/formats";
import { firstParam } from "@/features/decks/formats";
import { createFormat, deleteFormat, setFormatActive, updateFormat } from "./actions";

type Props = { searchParams: Promise<{ saved?: string | string[]; created?: string | string[]; deleted?: string | string[]; error?: string | string[] }> };

function optionalLimit(value: number | null) {
  return value ?? "";
}

export default async function AdminFormatsPage({ searchParams }: Props) {
  const query = await searchParams;
  const saved = z.string().max(50).optional().catch(undefined).parse(firstParam(query.saved));
  const created = z.string().max(50).optional().catch(undefined).parse(firstParam(query.created));
  const deleted = z.string().max(50).optional().catch(undefined).parse(firstParam(query.deleted));
  const error = z.string().max(300).optional().catch(undefined).parse(firstParam(query.error));
  const formats = await loadAdminFormats();

  return (
    <section aria-labelledby="admin-formats-title">
      <div className="admin-section-heading">
        <div><h2 id="admin-formats-title">Formatos</h2><p>Administra el catálogo, sus reglas básicas de construcción y su disponibilidad en toda la aplicación.</p></div>
        <span>{formats.length} formatos</span>
      </div>

      {error && <p className="form-message" role="alert">{error}</p>}
      {(saved || created || deleted) && <p className="admin-success" role="status"><CheckCircle2 size={17} /> {deleted ? `Formato ${deleted} eliminado.` : created ? `Formato ${created} creado.` : `Formato ${saved} actualizado.`}</p>}

      <details className="admin-format-create" open={formats.length === 0}>
        <summary><Plus size={16} /> Crear formato</summary>
        <form action={createFormat} className="admin-format-form">
          <div className="field"><label htmlFor="new-format-name">Nombre</label><input className="input" id="new-format-name" maxLength={60} name="name" required /></div>
          <div className="field"><label htmlFor="new-format-slug">Slug</label><input className="input" id="new-format-slug" maxLength={50} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></div>
          <div className="field admin-format-wide"><label htmlFor="new-format-description">Descripción</label><textarea className="textarea textarea-short" id="new-format-description" maxLength={1000} name="description" /></div>
          <div className="field admin-format-wide"><label htmlFor="new-format-rules">Resumen de reglas</label><input className="input" id="new-format-rules" maxLength={200} name="rulesSummary" required /></div>
          <div className="field"><label htmlFor="new-main-min">Principal mín.</label><input className="input" defaultValue={60} id="new-main-min" max={500} min={0} name="mainboardMin" type="number" /></div>
          <div className="field"><label htmlFor="new-main-max">Principal máx.</label><input className="input" id="new-main-max" max={500} min={0} name="mainboardMax" placeholder="Sin límite" type="number" /></div>
          <div className="field"><label htmlFor="new-commander-min">Comandantes mín.</label><input className="input" defaultValue={0} id="new-commander-min" max={10} min={0} name="commanderMin" type="number" /></div>
          <div className="field"><label htmlFor="new-commander-max">Comandantes máx.</label><input className="input" defaultValue={0} id="new-commander-max" max={10} min={0} name="commanderMax" type="number" /></div>
          <div className="field"><label htmlFor="new-total-min">Total mín.</label><input className="input" defaultValue={60} id="new-total-min" max={500} min={1} name="totalMin" type="number" /></div>
          <div className="field"><label htmlFor="new-total-max">Total máx.</label><input className="input" id="new-total-max" max={500} min={1} name="totalMax" placeholder="Sin límite" type="number" /></div>
          <div className="field"><label htmlFor="new-sort-order">Orden</label><input className="input" defaultValue={100} id="new-sort-order" max={10000} min={0} name="sortOrder" type="number" /></div>
          <label className="admin-format-checkbox"><input defaultChecked name="isActive" type="checkbox" /> Activo desde su creación</label>
          <button className="button admin-format-wide" type="submit"><Plus size={16} /> Crear formato</button>
        </form>
      </details>

      <div className="admin-format-list">
        {formats.map((format) => {
          const usage = format.deck_count + format.archetype_count + format.profile_count + format.organization_count;
          return (
            <article className={`admin-format-card ${saved === format.slug || created === format.slug ? "saved" : ""}`} key={format.slug}>
              <header>
                <div><span className={`admin-status ${format.is_active ? "admin-status-reviewed" : "admin-status-provisional"}`}>{format.is_active ? "Activo" : "Archivado"}</span><h3>{format.name}</h3><code>{format.slug}</code></div>
                <span>{usage} referencias</span>
              </header>
              <form action={updateFormat} className="admin-format-form">
                <input name="slug" type="hidden" value={format.slug} />
                <div className="field"><label htmlFor={`name-${format.slug}`}>Nombre</label><input className="input" defaultValue={format.name} id={`name-${format.slug}`} maxLength={60} name="name" required /></div>
                <div className="field"><label htmlFor={`sort-${format.slug}`}>Orden</label><input className="input" defaultValue={format.sort_order} id={`sort-${format.slug}`} max={10000} min={0} name="sortOrder" type="number" /></div>
                <div className="field admin-format-wide"><label htmlFor={`description-${format.slug}`}>Descripción</label><textarea className="textarea textarea-short" defaultValue={format.description} id={`description-${format.slug}`} maxLength={1000} name="description" /></div>
                <div className="field admin-format-wide"><label htmlFor={`rules-${format.slug}`}>Resumen de reglas</label><input className="input" defaultValue={format.rules_summary} id={`rules-${format.slug}`} maxLength={200} name="rulesSummary" required /></div>
                <div className="field"><label htmlFor={`main-min-${format.slug}`}>Principal mín.</label><input className="input" defaultValue={format.mainboard_min} id={`main-min-${format.slug}`} max={500} min={0} name="mainboardMin" type="number" /></div>
                <div className="field"><label htmlFor={`main-max-${format.slug}`}>Principal máx.</label><input className="input" defaultValue={optionalLimit(format.mainboard_max)} id={`main-max-${format.slug}`} max={500} min={0} name="mainboardMax" placeholder="Sin límite" type="number" /></div>
                <div className="field"><label htmlFor={`commander-min-${format.slug}`}>Comandantes mín.</label><input className="input" defaultValue={format.commander_min} id={`commander-min-${format.slug}`} max={10} min={0} name="commanderMin" type="number" /></div>
                <div className="field"><label htmlFor={`commander-max-${format.slug}`}>Comandantes máx.</label><input className="input" defaultValue={format.commander_max} id={`commander-max-${format.slug}`} max={10} min={0} name="commanderMax" type="number" /></div>
                <div className="field"><label htmlFor={`total-min-${format.slug}`}>Total mín.</label><input className="input" defaultValue={format.total_min} id={`total-min-${format.slug}`} max={500} min={1} name="totalMin" type="number" /></div>
                <div className="field"><label htmlFor={`total-max-${format.slug}`}>Total máx.</label><input className="input" defaultValue={optionalLimit(format.total_max)} id={`total-max-${format.slug}`} max={500} min={1} name="totalMax" placeholder="Sin límite" type="number" /></div>
                <input name="isActive" type="hidden" value={format.is_active ? "on" : ""} />
                <button className="button admin-format-wide" type="submit"><Save size={16} /> Guardar cambios</button>
              </form>
              <footer>
                <div className="admin-format-usage"><span>{format.deck_count} mazos</span><span>{format.archetype_count} arquetipos</span><span>{format.profile_count} perfiles</span><span>{format.organization_count} organizaciones</span></div>
                <div className="admin-format-actions">
                  <form action={setFormatActive}><input name="slug" type="hidden" value={format.slug} /><input name="nextActive" type="hidden" value={format.is_active ? "false" : "true"} /><button className="button button-secondary button-small" type="submit">{format.is_active ? <Archive size={15} /> : <ArchiveRestore size={15} />}{format.is_active ? "Archivar" : "Reactivar"}</button></form>
                  <form action={deleteFormat}><input name="slug" type="hidden" value={format.slug} /><ConfirmSubmitButton disabled={usage > 0} message={`¿Eliminar definitivamente el formato ${format.name}?`} title={usage > 0 ? "Archiva este formato porque todavía tiene referencias" : "Eliminar definitivamente"}><Trash2 size={15} /> Eliminar</ConfirmSubmitButton></form>
                </div>
              </footer>
            </article>
          );
        })}
      </div>
      {formats.length === 0 && <div className="empty-state"><BookOpen size={30} /><h2>No hay formatos</h2><p>Crea el primero para habilitar el catálogo público.</p></div>}
    </section>
  );
}
