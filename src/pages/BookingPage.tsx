import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { repository } from "../data/repository";
import { createProtectedBooking, getProtectedAvailability } from "../data/bookingApi";
import type { Appointment, Professional, Service, Tenant } from "../domain/types";
import { createSlots } from "../domain/availability";
import { resolveTenant } from "../lib/tenantResolver";
import { TenantTheme } from "../components/TenantTheme";
import { demoModeEnabled } from "../lib/firebase";

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function BookingPage() {
  const { tenantSlug } = useParams();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState(tomorrow());
  const [slot, setSlot] = useState("");
  const [available, setAvailable] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting,setSubmitting]=useState(false);
  const [loadError,setLoadError]=useState("");
  const [loaded,setLoaded]=useState(false);

  useEffect(()=>{
    let active=true;
    setLoaded(false);setLoadError("");setTenant(null);setServices([]);setProfessionals([]);setAppointments([]);
    setServiceId("");setProfessionalId("");setSlot("");setAvailable([]);
    resolveTenant(repository,tenantSlug).then(async resolved=>{
      if(!active)return;
      if(!resolved){setLoaded(true);return;}
      const [s,p,a]=await Promise.all([
        repository.listServices(resolved.id),repository.listProfessionals(resolved.id),
        demoModeEnabled()?repository.listAppointments(resolved.id):Promise.resolve([]),
      ]);
      if(!active)return;
      setTenant(resolved);setServices(s);setProfessionals(p);setAppointments(a);
      setServiceId(s[0]?.id??"");setProfessionalId(p[0]?.id??"");
      setLoaded(true);
    }).catch(error=>{
      if(active){setLoadError(error instanceof Error?error.message:"Falha ao carregar o studio.");setLoaded(true);}
    });
    return()=>{active=false;};
  },[tenantSlug]);

  const service = services.find((item) => item.id === serviceId);
  const eligibleProfessionals = professionals.filter((item) => item.serviceIds.includes(serviceId));
  const professional = eligibleProfessionals.find((item) => item.id === professionalId) ?? eligibleProfessionals[0];

  useEffect(() => {
    if (professional && professional.id !== professionalId) setProfessionalId(professional.id);
  }, [professional, professionalId]);

  const localSlots=useMemo(() => {
    if (!service || !professional) return [];
    return createSlots(date,service,professional,appointments);
  },[date,service,professional,appointments]);
  useEffect(() => {
    if (!tenant || !service || !professional || !date) {
      setAvailable([]);return;
    }
    if (demoModeEnabled()) {setAvailable(localSlots);setSlotsLoading(false);setSlotsError("");return;}
    let alive=true;
    setSlotsLoading(true);setSlotsError("");setAvailable([]);
    getProtectedAvailability({tenantId:tenant.id,serviceId:service.id,professionalId:professional.id,date})
      .then(slots=>{if(alive)setAvailable(slots);})
      .catch(err=>{if(alive)setSlotsError(err instanceof Error ? err.message : "Falha ao buscar horários.");})
      .finally(()=>{if(alive)setSlotsLoading(false);});
    return ()=>{alive=false;};
  },[tenant,service,professional,date,localSlots]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!tenant || !service || !professional || !slot || !name.trim() || !phone.trim()) {
      setMessage("Preencha os dados e selecione um horário.");
      return;
    }
    if(demoModeEnabled()){
      setMessage("Demonstração somente visual. Para gravar reserva, configure Firebase e Booking Worker.");
      return;
    }
    if(submitting)return;
    setSubmitting(true);setMessage("");
    try {
      await createProtectedBooking({ tenant, service, professionalId: professional.id, startsAt: slot, customerName: name.trim(), customerPhone: phone.trim() });
      setMessage("Agendamento confirmado para solicitação. A equipe poderá validar seu atendimento.");
      setSlot("");setName("");setPhone("");
      const latest=await getProtectedAvailability({tenantId:tenant.id,serviceId:service.id,professionalId:professional.id,date})
        .catch(()=>[]);
      setAvailable(latest);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível criar o agendamento.");
    }finally{setSubmitting(false);}
  }

  if(!loaded)return <section className="page" role="status">Carregando studio…</section>;
  if(loadError)return <section className="page" role="alert">{loadError}</section>;
  if(!tenant)return <section className="page">Studio não encontrado ou indisponível.</section>;

  return (
    <TenantTheme tenant={tenant}>
      <section className="page narrow">
        {tenant.kind === "demo" && <div className="badge">DEMONSTRAÇÃO</div>}
        <h1>Novo agendamento</h1>
        <form className="form" onSubmit={submit}>
          <label>Serviço<select value={serviceId} onChange={(e) => { setServiceId(e.target.value); setSlot(""); }}>
            {services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <label>Profissional<select value={professional?.id ?? ""} onChange={(e) => { setProfessionalId(e.target.value); setSlot(""); }}>
            {eligibleProfessionals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <label>Data<input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSlot(""); }} /></label>
          <fieldset><legend>Horário</legend>
            {slotsLoading && <p role="status">Verificando disponibilidade…</p>}
            {slotsError && <p role="alert">{slotsError}</p>}
            {!slotsLoading && !slotsError && available.length===0 && <p>Nenhum horário livre nessa data.</p>}
            <div className="slot-grid">
            {available.map((item) => <button type="button" key={item} className={slot === item ? "slot selected" : "slot"} onClick={() => setSlot(item)}>{item.split("T")[1].slice(0,5)}</button>)}
          </div></fieldset>
          <label>Nome<input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>Telefone<input required type="tel" inputMode="tel" autoComplete="tel" minLength={10} maxLength={22} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          <button className="button primary" type="submit" disabled={submitting||slotsLoading||!slot}>
            {submitting?"Confirmando…":"Solicitar agendamento"}
          </button>
        </form>
        {message && <div className="callout">{message}</div>}
        <Link to={`/app/${tenant.slug}`}>Ir para o painel →</Link>
      </section>
    </TenantTheme>
  );
}
