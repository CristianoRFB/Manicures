import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { repository } from "../data/repository";
import { createProtectedBooking, getProtectedAvailability } from "../data/bookingApi";
import type { Appointment, Professional, Service, Tenant } from "../domain/types";
import { createSlots } from "../domain/availability";
import { localCalendarDate, studioCalendarDate } from "../domain/localCalendarDate";
import { resolveTenant } from "../lib/tenantResolver";
import { TenantTheme } from "../components/TenantTheme";
import { demoModeEnabled } from "../lib/firebase";
import { useAuth } from "../auth/AuthProvider";

export function BookingPage() {
  const { tenantSlug } = useParams();
  const {user}=useAuth();
  const [linkedCustomer,setLinkedCustomer]=useState(false);
  const [checkingCustomer,setCheckingCustomer]=useState(false);
  const [customerLinkError,setCustomerLinkError]=useState("");
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState(localCalendarDate(1));
  const [slot, setSlot] = useState("");
  const [available, setAvailable] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [receipt,setReceipt]=useState<{id:string;service:string;professional:string;start:string;priceCents:number}|null>(null);
  const [submitting,setSubmitting]=useState(false);
  const [loadError,setLoadError]=useState("");
  const [loaded,setLoaded]=useState(false);

  useEffect(()=>{
    let active=true;
    setLoaded(false);setLoadError("");setTenant(null);setServices([]);setProfessionals([]);setAppointments([]);
    setServiceId("");setProfessionalId("");setSlot("");setAvailable([]);setReceipt(null);
    resolveTenant(repository,tenantSlug).then(async resolved=>{
      if(!active)return;
      if(!resolved){setLoaded(true);return;}
      const [s,p,a]=await Promise.all([
        repository.listServices(resolved.id),repository.listProfessionals(resolved.id),
        demoModeEnabled()?repository.listAppointments(resolved.id):Promise.resolve([]),
      ]);
      if(!active)return;
      setTenant(resolved);setServices(s);setProfessionals(p);setAppointments(a);
      setDate(studioCalendarDate(resolved.businessSettings?.timezone || "America/Sao_Paulo",1));
      setServiceId(s[0]?.id??"");setProfessionalId(p[0]?.id??"");
      setLoaded(true);
    }).catch(error=>{
      if(active){setLoadError(error instanceof Error?error.message:"Falha ao carregar o studio.");setLoaded(true);}
    });
    return()=>{active=false;};
  },[tenantSlug]);

  useEffect(()=>{
    let live=true;
    setLinkedCustomer(false);setCheckingCustomer(false);setCustomerLinkError("");
    if(!tenant||!user||!user.emailVerified||demoModeEnabled())return;
    setCheckingCustomer(true);
    repository.getMembership(tenant.id,user.uid).then(member=>{
      if(live)setLinkedCustomer(Boolean(member?.status==="active"&&member.role==="customer"
        &&member.customerId===user.uid&&member.tenantId===tenant.id));
    }).catch(()=>{if(live)setCustomerLinkError("Não foi possível verificar o vínculo da sua conta. Reabra a área do cliente.");})
      .finally(()=>{if(live)setCheckingCustomer(false);});
    return()=>{live=false;};
  },[tenant?.id,user?.uid]);

  const timezone = tenant?.businessSettings?.timezone || "America/Sao_Paulo";
  const studioToday = tenant ? studioCalendarDate(timezone) : localCalendarDate();
  const horizonDays = tenant?.businessSettings?.bookingHorizonDays;
  const studioMaxDate = tenant && typeof horizonDays === "number" && Number.isSafeInteger(horizonDays)
    && horizonDays > 0 && horizonDays <= 365 ? studioCalendarDate(timezone,horizonDays) : null;
  const invalidCalendarDate = date < studioToday || Boolean(studioMaxDate && date > studioMaxDate);
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
      setAvailable([]);setSlotsLoading(false);return;
    }
    if (invalidCalendarDate) {
      setAvailable([]);setSlot("");setSlotsLoading(false);
      setSlotsError(date < studioToday
        ? "Selecione uma data atual ou futura no calendário do studio."
        : "A data escolhida ultrapassa o prazo de agendamento do studio.");return;
    }
    if (demoModeEnabled()) {setAvailable(localSlots);setSlot(current=>localSlots.includes(current)?current:"");setSlotsLoading(false);setSlotsError("");return;}
    let alive=true;
    setSlotsLoading(true);setSlotsError("");setAvailable([]);
    getProtectedAvailability({tenantId:tenant.id,serviceId:service.id,professionalId:professional.id,date})
      .then(slots=>{if(alive){setAvailable(slots);setSlot(current=>slots.includes(current)?current:"");}})
      .catch(err=>{if(alive)setSlotsError(err instanceof Error ? err.message : "Falha ao buscar horários.");})
      .finally(()=>{if(alive)setSlotsLoading(false);});
    return ()=>{alive=false;};
  },[tenant,service,professional,date,localSlots,invalidCalendarDate,studioToday]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!tenant || !service || !professional || !slot || !available.includes(slot) || invalidCalendarDate || !name.trim() || !phone.trim()) {
      setMessage("Preencha os dados e selecione um horário.");
      return;
    }
    if(demoModeEnabled()){
      setMessage("Demonstração somente visual. Para gravar reserva, configure Firebase e Booking Worker.");
      return;
    }
    if(submitting||checkingCustomer||customerLinkError)return;
    setSubmitting(true);setMessage("");setReceipt(null);
    try {
      const saved=await createProtectedBooking({ tenant, service, professionalId: professional.id,
        startsAt: slot, customerName: name.trim(), customerPhone: phone.trim(),
        authToken:linkedCustomer&&user?await user.getIdToken(true):undefined });
      setReceipt({id:saved.id,service:service.name,professional:professional.name,
        start:saved.startsAt,priceCents:saved.priceSnapshotCents});
      setMessage("Agendamento confirmado para solicitação. A equipe poderá validar seu atendimento.");
      setSlot("");setName("");setPhone("");
      try {
        const latest=await getProtectedAvailability({tenantId:tenant.id,serviceId:service.id,professionalId:professional.id,date});
        setAvailable(latest);setSlotsError("");
      } catch {
        setAvailable([]);
        setSlotsError("Reserva registrada, mas não foi possível atualizar os horários. Atualize a página antes de tentar outra reserva.");
      }
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
        <p className="subtle">Horários no fuso do studio: {timezone}.</p>
        <p>{linkedCustomer?"Reserva vinculada à sua conta de cliente verificada.":"Reserva como visitante: ela não aparecerá no histórico de nenhuma conta sem vínculo autenticado."}</p>
        {checkingCustomer&&<p role="status">Validando vínculo da sua conta…</p>}
        {customerLinkError&&<p role="alert">{customerLinkError}</p>}
        <Link to={`/customer/${tenant.slug}`}>Entrar, cadastrar ou ver meus horários</Link>
        <form className="form" onSubmit={submit}>
          <label>Serviço<select disabled={submitting} value={serviceId} onChange={(e) => { setServiceId(e.target.value); setSlot(""); }}>
            {services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <label>Profissional<select disabled={submitting} value={professional?.id ?? ""} onChange={(e) => { setProfessionalId(e.target.value); setSlot(""); }}>
            {eligibleProfessionals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <label>Data<input type="date" min={studioToday} max={studioMaxDate || undefined} disabled={submitting} value={date} onChange={(e) => { setDate(e.target.value); setSlot(""); }} /></label>
          <fieldset><legend>Horário</legend>
            {slotsLoading && <p role="status">Verificando disponibilidade…</p>}
            {slotsError && <p role="alert">{slotsError}</p>}
            {!slotsLoading && !slotsError && available.length===0 && <p>Nenhum horário livre nessa data.</p>}
            <div className="slot-grid">
            {available.map((item) => <button type="button" key={item} className={slot === item ? "slot selected" : "slot"} aria-pressed={slot === item} aria-label={`Selecionar horário ${item.split("T")[1].slice(0,5)}`} disabled={submitting} onClick={() => setSlot(item)}>{item.split("T")[1].slice(0,5)}</button>)}
          </div></fieldset>
          <label>Nome<input disabled={submitting} required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>Telefone<input disabled={submitting} required type="tel" inputMode="tel" autoComplete="tel" minLength={10} maxLength={22} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          <button className="button primary" type="submit" disabled={submitting||slotsLoading||checkingCustomer||Boolean(customerLinkError)||!slot||!available.includes(slot)||invalidCalendarDate}>
            {submitting?"Confirmando…":"Solicitar agendamento"}
          </button>
        </form>
        {message && <div className="callout" role="status">{message}</div>}
        {receipt && <section className="card" aria-label="Comprovante da solicitação">
          <h2>Solicitação registrada</h2>
          <p><strong>Protocolo:</strong> <code>{receipt.id}</code></p>
          <p>{receipt.service} com {receipt.professional}</p>
          <p>{receipt.start.replace("T"," ").slice(0,16)}</p>
          <p>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(receipt.priceCents/100)}</p>
          <p>Guarde este protocolo. Ele não é um link público e não expõe dados pessoais.</p>
        </section>}
        <Link to={`/customer/${tenant.slug}`}>Minha agenda</Link>
      </section>
    </TenantTheme>
  );
}
