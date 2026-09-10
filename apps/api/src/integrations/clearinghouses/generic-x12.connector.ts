import { Injectable } from '@nestjs/common';
import { VendorConnectorBase } from '../vendors/vendor-connector.base';
import { X12GeneratorService } from '../x12/x12-generator.service';
@Injectable()
export class GenericX12Connector extends VendorConnectorBase {
 public override readonly provider='generic-x12';
 protected override get displayName(){return 'Generic X12';}
 protected override get patientPrefix(){return 'X12';}
 protected override get mrnPrefix(){return 'X12RN';}

  async submitClaim837I(d:{patientFirstName:string;patientLastName:string;patientMemberId:string;icd10Codes:string[];billedAmount:number;serviceDate:Date;institutionNpi?:string;revenueCode?:string}){ const claimId=`x12_837i_1`; const x12=await (this.x12Generator ?? new X12GeneratorService()).generateInstitutionalClaim837I(claimId,d.institutionNpi??'1234567890',d.patientFirstName,d.patientLastName,new Date('1990-01-01'),d.patientMemberId,d.icd10Codes,d.revenueCode??'0900',d.billedAmount,d.serviceDate); return {success:true,claimId,x12,status:'SUBMITTED' as const}; }

}
