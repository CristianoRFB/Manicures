import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { repository } from "../data/repository";
import type { Appointment, Professional, Service, Tenant } from "../domain/types";
import { addMinutes, createSlots } from "../domain/availability";
import { resolveTenant } from "../lib/tenantResolver";
import { TenantTheme } from "../components/TenantTheme";

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
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    resolveTenant(repository, tenantSlug).then(async (resolved) => {
      if (!resolved) return;
      setTenant(resolved);
      const [s, p, a] = await Promise.all([
        repository.listServices(resolved.id),
        repository.listProfessionals(resolved.id),
        repository.listAppointments(resolved.id),
      ]);
      setServices(s);
      setProfessionals(p);
      setAppointments(a);
      if (s[0]) setServiceId(s[0].id);
      if (p[0]) setProfessionalId(p[0].id);
    });
  }, [tenantSlug]);

  const service = services.find((item) => item.id === serviceId);
  const eligibleProfessionals = professionals.filter((item) => item.serviceIds.includes(serviceId));
  const professional = eligibleProfessionals.find((item) => item.id === professionalId) ?? eligibleProfessionals[0];

  useEffect(() => {
    if (professional && professional.id !== professionalId) setProfessionalId(professional.id);
  }, [professional, professionalId]);

  const slots = useMemo(() => {
    if (!service || !professional) return [];
    return createSlots(date, service, professional, appointments);
  }, [date, service, professional, appointments]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!tenant || !service || !professional || !slot || !name.trim() || !phone.trim()) {
      setMessage("Preencha os dados e selecione um horário.");
      return;
    }
    const now = new Date().toISOString();
    const appointment: Appointment = {
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      customerName: name.trim(),
      customerPhone: phone.trim(),
      professionalId: professional.id,
      serviceId: service.id,
      startsAt: slot,
      endsAt: addMinutes(slot, service.durationMin),
      priceSnapshotCents: service.priceCents,
      durationSnapshotMin: service.durationMin,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    try {
      await repository.createAppointment(appointment);
      setAppointments(await repository.listAppointments(tenant.id));
      setMessage("Agendamento criado na DEMO. Abra o painel para conferi-lo.");
      setSlot("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível criar o agendamento.");
    }
  }

  if (!tenant) return <section className="page">Carregando tenant…</section>;

  return (
    <TenantTheme tenant={tenant}>
      <section className="page narrow">
        <div className="badge">DEMONSTRAÇÃO</div>
        <h1>Novo agendamento</h1>
        <form className="form" onSubmit={submit}>
          <label>Serviço<select value={serviceId} onChange={(e) => { setServiceId(e.target.value); setSlot(""); }}>
            {services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <label>Profissional<select value={professional?.id ?? ""} onChange={(e) => { setProfessionalId(e.target.value); setSlot(""); }}>
            {eligibleProfessionals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <label>Data<input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSlot(""); }} /></label>
          <fieldset><legend>Horário</legend><div className="slot-grid">
            {slots.map((item) => {
              const time = item.split("T")[1].slice(0, 5);
              return <button type="button" key={item} className={slot === item ? "slot selected" : "slot"} onClick={() => setSlot(item)}>{time}</button>;
            })}
          </div></fieldset>
          <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cliente Demonstração" /></label>
          <label>Telefone<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="00000000000" /></label>
          <button className="button primary" type="submit">Confirmar agendamento DEMO</button>
        </form>
        {message && <div className="callout">{message}</div>}
        <Link to={`/app/${tenant.slug}`}>Ir para o painel →</Link>
      </section>
    </TenantTheme>
  );
}
