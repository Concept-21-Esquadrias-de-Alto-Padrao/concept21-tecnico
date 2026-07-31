import { CalendarDays, ChevronDown, Settings } from "lucide-react";
import {
  saveTechnicalDeadlineSettingsAction,
  saveTechnicalDoubtCategoryAction,
  saveTechnicalHolidayAction,
  saveTechnicalListSettingAction,
  saveTechnicalNotificationSettingsAction,
  saveTechnicalRiskSettingsAction,
} from "@/app/actions";
import { ActionForm, Field, inputClass, textareaClass } from "@/components/action-form";
import {
  deadlineSettingDefinitions,
  getTechnicalSettingsData,
  listSettingDefinitions,
  notificationSettingDefinition,
  riskBandDefinitions,
  settingValue,
  technicalDoubtAreaOptions,
} from "@/lib/technical-settings";
import type { TechnicalHoliday, TechnicalSetting } from "@/lib/types";
import { cn } from "@/lib/utils";

type RiskBand = {
  key: string;
  percentual: number;
};

type NotificationSettings = {
  intervalo_reenvio_horas: number;
  notificar_pendencias_entrega: boolean;
};

function asStringList(value: unknown, fallback: readonly string[]) {
  return Array.isArray(value) ? value.map(String) : [...fallback];
}

function asNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function riskValue(settings: TechnicalSetting[], key: string, fallback: number) {
  const bands = settingValue<RiskBand[]>(
    settings,
    "faixas_risco",
    riskBandDefinitions.map((definition) => ({
      key: definition.key,
      percentual: definition.defaultValue,
    })),
  );
  return bands.find((band) => band.key === key)?.percentual ?? fallback;
}

function notificationValue(settings: TechnicalSetting[]) {
  const value = settingValue<Partial<NotificationSettings>>(
    settings,
    notificationSettingDefinition.key,
    notificationSettingDefinition.defaultValue,
  );

  return {
    intervalo_reenvio_horas: asNumber(
      value.intervalo_reenvio_horas,
      notificationSettingDefinition.defaultValue.intervalo_reenvio_horas,
    ),
    notificar_pendencias_entrega:
      typeof value.notificar_pendencias_entrega === "boolean"
        ? value.notificar_pendencias_entrega
        : notificationSettingDefinition.defaultValue.notificar_pendencias_entrega,
  };
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-md border border-border bg-white">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-3 marker:hidden">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="size-4 text-accent" />
            <p className="font-semibold text-charcoal">{title}</p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <ChevronDown className="mt-1 size-4 flex-none text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-border p-3">{children}</div>
    </details>
  );
}

function ListSettingCard({
  settings,
  definition,
}: {
  settings: TechnicalSetting[];
  definition: (typeof listSettingDefinitions)[number];
}) {
  const items = asStringList(
    settingValue(settings, definition.key, definition.defaultItems),
    definition.defaultItems,
  );

  return (
    <SettingsCard title={definition.title} description={definition.description}>
      <ActionForm action={saveTechnicalListSettingAction} submitLabel="Salvar">
        <input type="hidden" name="key" value={definition.key} />
        <Field label="Itens">
          <textarea
            name="items"
            className={textareaClass}
            defaultValue={items.join("\n")}
            rows={Math.max(4, items.length)}
            required
          />
        </Field>
      </ActionForm>
    </SettingsCard>
  );
}

function DeadlineSettingsCard({ settings }: { settings: TechnicalSetting[] }) {
  return (
    <SettingsCard
      title="Prazos internos"
      description="Prazos padrão em dias úteis para o fluxo técnico, suprimentos e produção."
    >
      <ActionForm action={saveTechnicalDeadlineSettingsAction} submitLabel="Salvar prazos">
        <div className="grid gap-3 sm:grid-cols-3">
          {deadlineSettingDefinitions.map((definition) => (
            <Field key={definition.key} label={`${definition.label} (dias úteis)`}>
              <input
                type="number"
                min={1}
                step={1}
                name={definition.key}
                className={inputClass}
                defaultValue={asNumber(
                  settingValue(settings, definition.key, definition.defaultValue),
                  definition.defaultValue,
                )}
                required
              />
            </Field>
          ))}
        </div>
      </ActionForm>
    </SettingsCard>
  );
}

function RiskSettingsCard({ settings }: { settings: TechnicalSetting[] }) {
  return (
    <SettingsCard
      title="Percentuais de risco"
      description="Limites percentuais usados para indicar atenção, risco e atraso."
    >
      <ActionForm action={saveTechnicalRiskSettingsAction} submitLabel="Salvar percentuais">
        <div className="grid gap-3 sm:grid-cols-3">
          {riskBandDefinitions.map((definition) => (
            <Field key={definition.key} label={`${definition.label} (%)`}>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                name={definition.key}
                className={inputClass}
                defaultValue={riskValue(settings, definition.key, definition.defaultValue)}
                required
              />
            </Field>
          ))}
        </div>
      </ActionForm>
    </SettingsCard>
  );
}

function DoubtCategoriesCard({
  categories,
}: {
  categories: Awaited<ReturnType<typeof getTechnicalSettingsData>>["doubtCategories"];
}) {
  return (
    <SettingsCard
      title="Categorias de dúvidas"
      description="Categorias usadas na base de dúvidas de produção e obras/instalações."
    >
      <div className="space-y-4">
        {categories.length ? (
          <div className="space-y-3">
            {categories.map((category) => (
              <ActionForm
                key={category.id}
                action={saveTechnicalDoubtCategoryAction}
                submitLabel="Salvar"
                className="rounded-md border border-border bg-muted/30 p-3"
              >
                <input type="hidden" name="id" value={category.id} />
                <div className="grid gap-3 lg:grid-cols-[1.2fr_1.5fr_0.7fr_0.5fr]">
                  <Field label="Área">
                    <select name="area" className={inputClass} defaultValue={category.area}>
                      {technicalDoubtAreaOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Categoria">
                    <input name="name" className={inputClass} defaultValue={category.name} required />
                  </Field>
                  <Field label="Ordem">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      name="sort_order"
                      className={inputClass}
                      defaultValue={category.sort_order}
                      required
                    />
                  </Field>
                  <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold text-charcoal">
                    <input type="checkbox" name="active" defaultChecked={category.active} />
                    Ativa
                  </label>
                </div>
              </ActionForm>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
        )}

        <ActionForm
          action={saveTechnicalDoubtCategoryAction}
          submitLabel="Adicionar categoria"
          className="rounded-md border border-dashed border-border p-3"
        >
          <div className="grid gap-3 lg:grid-cols-[1.2fr_1.5fr_0.7fr_0.5fr]">
            <Field label="Área">
              <select name="area" className={inputClass} defaultValue="producao">
                {technicalDoubtAreaOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nova categoria">
              <input name="name" className={inputClass} required />
            </Field>
            <Field label="Ordem">
              <input type="number" min={0} step={1} name="sort_order" className={inputClass} defaultValue={1} required />
            </Field>
            <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold text-charcoal">
              <input type="checkbox" name="active" defaultChecked />
              Ativa
            </label>
          </div>
        </ActionForm>
      </div>
    </SettingsCard>
  );
}

function HolidayForm({ holiday }: { holiday?: TechnicalHoliday }) {
  return (
    <ActionForm
      action={saveTechnicalHolidayAction}
      submitLabel={holiday ? "Salvar" : "Adicionar feriado"}
      className={cn("rounded-md border p-3", holiday ? "border-border bg-muted/30" : "border-dashed border-border")}
    >
      {holiday ? <input type="hidden" name="id" value={holiday.id} /> : null}
      <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr_1fr_0.8fr_0.8fr_0.5fr]">
        <Field label="Data">
          <input
            type="date"
            name="holiday_date"
            className={inputClass}
            defaultValue={holiday?.holiday_date ?? ""}
            required
          />
        </Field>
        <Field label="Nome">
          <input name="name" className={inputClass} defaultValue={holiday?.name ?? ""} required />
        </Field>
        <Field label="Escopo">
          <select name="scope" className={inputClass} defaultValue={holiday?.scope ?? "nacional"}>
            <option value="nacional">Nacional</option>
            <option value="estadual">Estadual</option>
            <option value="municipal">Municipal</option>
          </select>
        </Field>
        <Field label="Cidade">
          <input name="city" className={inputClass} defaultValue={holiday?.city ?? ""} />
        </Field>
        <Field label="UF">
          <input name="state" className={inputClass} defaultValue={holiday?.state ?? ""} maxLength={2} />
        </Field>
        <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold text-charcoal">
          <input type="checkbox" name="active" defaultChecked={holiday?.active ?? true} />
          Ativo
        </label>
      </div>
    </ActionForm>
  );
}

function HolidaysCard({ holidays }: { holidays: TechnicalHoliday[] }) {
  return (
    <SettingsCard
      title="Feriados"
      description="Calendário de feriados considerados no planejamento técnico."
    >
      <div className="space-y-4">
        {holidays.length ? (
          <div className="space-y-3">
            {holidays.map((holiday) => (
              <HolidayForm key={holiday.id} holiday={holiday} />
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" />
            Nenhum feriado cadastrado.
          </p>
        )}

        <HolidayForm />
      </div>
    </SettingsCard>
  );
}

function NotificationSettingsCard({ settings }: { settings: TechnicalSetting[] }) {
  const value = notificationValue(settings);

  return (
    <SettingsCard
      title={notificationSettingDefinition.title}
      description={notificationSettingDefinition.description}
    >
      <ActionForm action={saveTechnicalNotificationSettingsAction} submitLabel="Salvar notificações">
        <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr]">
          <Field label="Intervalo de reenvio (horas)">
            <input
              type="number"
              min={1}
              step={1}
              name="intervalo_reenvio_horas"
              className={inputClass}
              defaultValue={value.intervalo_reenvio_horas}
              required
            />
          </Field>
          <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold text-charcoal">
            <input
              type="checkbox"
              name="notificar_pendencias_entrega"
              defaultChecked={value.notificar_pendencias_entrega}
            />
            Notificar pendências de entrega entre departamentos
          </label>
        </div>
      </ActionForm>
    </SettingsCard>
  );
}

export async function TechnicalSettingsPanel() {
  const data = await getTechnicalSettingsData();

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {listSettingDefinitions.slice(0, 6).map((definition) => (
        <ListSettingCard key={definition.key} settings={data.settings} definition={definition} />
      ))}

      <DoubtCategoriesCard categories={data.doubtCategories} />
      <ListSettingCard settings={data.settings} definition={listSettingDefinitions[6]} />
      <DeadlineSettingsCard settings={data.settings} />
      <RiskSettingsCard settings={data.settings} />
      <HolidaysCard holidays={data.holidays} />
      <ListSettingCard settings={data.settings} definition={listSettingDefinitions[7]} />
      <NotificationSettingsCard settings={data.settings} />
    </div>
  );
}
