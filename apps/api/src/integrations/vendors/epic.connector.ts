import { Injectable } from '@nestjs/common';
import { VendorConnectorBase } from './vendor-connector.base';
@Injectable()
export class EpicConnector extends VendorConnectorBase {
  public override readonly provider='epic';
  protected override get displayName(){return 'Epic';}
  protected override get mrnPrefix(){return 'EPMRN';}
  protected override get appointmentPrefix(){return 'ep_appt';}
  protected override get patientPrefix(){return 'Synthetic';}
  override async getPatientDemographics(patientId:string){ const r:any=await super.getPatientDemographics(patientId); if(r.patient) r.patient.id=`ep_patient_${patientId}`; return r; }
  async syncFhirResources(resourceTypes:('Patient'|'Appointment'|'Claim'|'Condition'|'Medication')[]){ const resources=resourceTypes.map((resourceType,i)=>({resourceType,id:`${resourceType.toLowerCase()}_${i+1}`,status:'active'})); return {success:true,synced:resources.length,resources,error:undefined}; }
}
