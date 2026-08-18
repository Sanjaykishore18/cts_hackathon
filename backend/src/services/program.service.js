const programRepository = require('../repositories/program.repository');

class ProgramService {
  async getAll() {
    return programRepository.findAll();
  }

  async getById(programId) {
    return programRepository.findById(programId);
  }
}

module.exports = new ProgramService();
