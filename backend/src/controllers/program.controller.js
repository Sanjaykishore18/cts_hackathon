const programService = require('../services/program.service');

class ProgramController {
  async getAllPrograms(req, res, next) {
    try {
      const programs = await programService.getAll();
      res.status(200).json({
        success: true,
        data: programs
      });
    } catch (error) {
      next(error);
    }
  }

  async getProgramById(req, res, next) {
    try {
      const { programId } = req.params;
      const program = await programService.getById(programId);

      if (!program) {
        const error = new Error(`Program with ID ${programId} not found`);
        error.status = 404;
        error.code = 'PROGRAM_NOT_FOUND';
        return next(error);
      }

      res.status(200).json({
        success: true,
        data: program
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProgramController();
